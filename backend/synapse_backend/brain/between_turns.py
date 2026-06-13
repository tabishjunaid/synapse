"""The between-turns planner — the live, stronger-model coach.

Phase 1's between-turns brain. While the fast path keeps the conversation alive
(small model, in-round-trip), this runs *alongside* it on the planner brain
(`effective_planner_brain` — Opus when funded): it re-reads the running
transcript, re-estimates the learner's mastery of each lesson skill, and emits a
one-line focus steer the fast path folds into its next turns. Pure brain logic —
no Mongo; persistence + transport are the caller's job (courses.py / gateway).
"""

from __future__ import annotations

import logging

from synapse_backend.config import get_settings

from . import prompts
from .schemas import BetweenTurnsUpdate, Lesson
from .teacher import build_backend

logger = logging.getLogger(__name__)


def _format_transcript(transcript: list[dict]) -> str:
    lines = []
    for msg in transcript:
        role = "Learner" if msg.get("role") == "user" else "Tutor"
        content = (msg.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def plan_between_turns(lesson: Lesson, transcript: list[dict]) -> BetweenTurnsUpdate:
    """Re-read the live session into a learner-model update + focus steer.

    Best-effort: a malformed reply yields an empty update so a live lesson is
    never broken by the coach. Skill ids the model invents are dropped.
    """
    backend = build_backend(get_settings().effective_planner_brain)
    skills = [{"id": s.id, "name": s.name} for s in lesson.skills]
    user = prompts.between_turns_user(
        lesson.title, lesson.objectives, skills, _format_transcript(transcript)
    )
    try:
        raw = await backend.complete_json(
            system=prompts.BETWEEN_TURNS_SYSTEM, user=user, max_tokens=800
        )
        update = BetweenTurnsUpdate.model_validate(raw)
    except Exception:  # malformed reply (ValidationError) or backend error
        logger.warning("between-turns planner failed; skipping this update", exc_info=True)
        return BetweenTurnsUpdate()

    valid = {s.id for s in lesson.skills}
    update.skills = [s for s in update.skills if s.skill_id in valid]
    return update
