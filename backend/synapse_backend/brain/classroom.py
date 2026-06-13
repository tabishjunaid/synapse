"""Generators for the immersive classroom: whiteboard board + tap-to-deepen glossary.

Both are structured LLM generations validated for safety (the board's MathML is
rendered via dangerouslySetInnerHTML on the client, so malformed markup is dropped
rather than passed through). Results are cached per lesson by the courses service.
"""

from __future__ import annotations

import logging

from synapse_backend.config import get_settings

from . import prompts
from .schemas import Lesson
from .teacher import build_backend

logger = logging.getLogger(__name__)

DIAGRAM_KEYS = {"derivative", "freefall", "arabic-letters", "major-scale"}


def _safe_mathml(value: object) -> str:
    """Only pass through a complete, well-formed-looking <math> element."""
    if not isinstance(value, str):
        return ""
    v = value.strip()
    if v.startswith("<math") and v.endswith("</math>") and "<script" not in v.lower():
        return v
    return ""


async def generate_board(lesson: Lesson, subject: str = "") -> dict:
    backend = build_backend(get_settings().effective_planner_brain)
    raw = await backend.complete_json(
        system=prompts.BOARD_SYSTEM,
        user=prompts.board_user(lesson.title, lesson.objectives, subject or lesson.title),
        max_tokens=800,
    )
    if not isinstance(raw, dict):
        raw = {}
    diagram = raw.get("diagram", "")
    return {
        "title": (raw.get("title") or lesson.title)[:80],
        "diagram": diagram if diagram in DIAGRAM_KEYS else "",
        "math": _safe_mathml(raw.get("math")) or None,
        "note": (raw.get("note") or "")[:240],
    }


async def generate_glossary(lesson: Lesson) -> dict:
    backend = build_backend(get_settings().effective_planner_brain)
    raw = await backend.complete_json(
        system=prompts.GLOSSARY_SYSTEM,
        user=prompts.glossary_user(lesson.title, lesson.objectives),
        max_tokens=700,
    )
    terms = raw.get("terms") if isinstance(raw, dict) else None
    clean: dict[str, str] = {}
    if isinstance(terms, dict):
        for key, val in terms.items():
            if isinstance(key, str) and isinstance(val, str) and val.strip():
                clean[key.strip().lower()] = val.strip()[:200]
    return {"terms": clean}
