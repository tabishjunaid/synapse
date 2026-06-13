"""Lesson assessment — score each skill from the session transcript.

A structured generation against the planner brain, validated against
LessonAssessment. Drives mastery updates + gating in courses.py.
"""

from __future__ import annotations

import logging

from pydantic import ValidationError

from synapse_backend.config import get_settings

from . import prompts
from .schemas import Lesson, LessonAssessment
from .teacher import build_backend

logger = logging.getLogger(__name__)


def _format_transcript(transcript: list[dict]) -> str:
    lines = []
    for msg in transcript:
        role = "Learner" if msg.get("role") == "user" else "Teacher"
        content = (msg.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def assess_lesson(lesson: Lesson, transcript: list[dict]) -> LessonAssessment:
    settings = get_settings()
    backend = build_backend(settings.effective_planner_brain)

    skills = [{"id": s.id, "name": s.name} for s in lesson.skills]
    user = prompts.grader_user(lesson.title, lesson.objectives, skills, _format_transcript(transcript))

    raw = await backend.complete_json(
        system=prompts.GRADER_SYSTEM, user=user, max_tokens=1500
    )
    try:
        assessment = LessonAssessment.model_validate(raw)
    except ValidationError:
        logger.warning("grader returned malformed assessment; defaulting to zero", exc_info=True)
        assessment = LessonAssessment()

    # Keep only known skill ids; the model occasionally invents or renames them.
    valid = {s.id for s in lesson.skills}
    assessment.skills = [s for s in assessment.skills if s.skill_id in valid]
    return assessment
