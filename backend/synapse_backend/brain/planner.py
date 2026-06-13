"""Course formulation — turn a GoalSpec into a structured CoursePlan.

A single structured generation against the planner brain (which can be a stronger
model than the in-loop fast path), validated against the Pydantic schema with one
repair retry, then deterministic id/order assignment so the gating + mastery layer
has stable handles.
"""

from __future__ import annotations

import logging

from pydantic import ValidationError

from synapse_backend.config import get_settings

from . import prompts
from .schemas import (
    CoursePlan,
    GoalSpec,
    PlacementQuestion,
    PlacementResult,
)
from .teacher import build_backend

logger = logging.getLogger(__name__)


def quick_placement(goal: GoalSpec) -> PlacementResult:
    """A no-LLM baseline: trust the learner's self-reported level. Used when the
    learner skips the diagnostic."""
    return PlacementResult(estimated_level=goal.level)


async def generate_placement_questions(goal: GoalSpec) -> list[PlacementQuestion]:
    backend = build_backend(get_settings().effective_planner_brain)
    raw = await backend.complete_json(
        system=prompts.PLACEMENT_QUESTIONS_SYSTEM,
        user=f"Subject: {goal.subject}\nGoal: {goal.target_outcome}\nGenerate the diagnostic.",
        max_tokens=600,
    )
    items = raw.get("questions", []) if isinstance(raw, dict) else []
    out: list[PlacementQuestion] = []
    for i, item in enumerate(items[:4], start=1):
        prompt = item.get("prompt") if isinstance(item, dict) else str(item)
        if prompt:
            out.append(PlacementQuestion(id=f"q{i}", prompt=prompt))
    return out


async def assess_placement(goal: GoalSpec, qa: list[dict]) -> PlacementResult:
    """Grade diagnostic answers into a PlacementResult. Falls back to self-report."""
    if not any((x.get("answer") or "").strip() for x in qa):
        return quick_placement(goal)
    backend = build_backend(get_settings().effective_planner_brain)
    raw = await backend.complete_json(
        system=prompts.PLACEMENT_ASSESS_SYSTEM,
        user=prompts.placement_assess_user(goal.model_dump_json(), qa),
        max_tokens=600,
    )
    try:
        return PlacementResult.model_validate(raw)
    except ValidationError:
        logger.warning("placement assessment malformed; using self-report", exc_info=True)
        return quick_placement(goal)


async def generate_course(
    goal: GoalSpec,
    placement: PlacementResult | None = None,
    grounding_context: str = "",
) -> CoursePlan:
    settings = get_settings()
    backend = build_backend(settings.effective_planner_brain)

    placement = placement or quick_placement(goal)
    placement_note = (
        f"\nPlacement: start at {placement.estimated_level} level."
        + (f" Already comfortable with: {', '.join(placement.known_skills)}."
           if placement.known_skills else "")
    )
    grounding = prompts.GROUNDING_NOTE.format(context=grounding_context) if grounding_context else ""
    user = prompts.planner_user(goal.model_dump_json(), placement_note, grounding)

    raw = await backend.complete_json(
        system=prompts.PLANNER_SYSTEM, user=user, max_tokens=settings.planner_max_tokens
    )
    try:
        plan = CoursePlan.model_validate(raw)
    except ValidationError as first:
        logger.warning("course plan invalid, repairing once: %s", first)
        repair = (
            user
            + f"\n\nYour previous reply did not match the schema ({first.error_count()} "
            "errors). Return ONLY the corrected JSON object, exactly matching the shape."
        )
        raw = await backend.complete_json(
            system=prompts.PLANNER_SYSTEM, user=repair, max_tokens=settings.planner_max_tokens
        )
        try:
            plan = CoursePlan.model_validate(raw)
        except ValidationError as second:
            raise ValueError(
                "The planner returned a malformed course twice. Try again, or use a "
                "stronger SYNAPSE_PLANNER_BRAIN (e.g. deepseek)."
            ) from second

    _assign_ids(plan)
    return plan


def _assign_ids(plan: CoursePlan) -> None:
    """Deterministic ids/orders so gating + mastery have stable handles."""
    for mi, module in enumerate(plan.modules, start=1):
        module.id = f"m{mi}"
        module.order = mi
        for li, lesson in enumerate(module.lessons, start=1):
            lesson.id = f"m{mi}l{li}"
            lesson.order = li
            for si, skill in enumerate(lesson.skills, start=1):
                skill.id = f"m{mi}l{li}s{si}"
