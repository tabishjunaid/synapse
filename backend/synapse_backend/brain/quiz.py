"""Pre/post micro-quizzes — the falsifiable 'did it teach?' signal.

A short quiz on a lesson's objectives, taken before (pre) and after (post). The
pre→post delta over many lessons is the d≈0.8 evaluation loop; scores land in
QuestDB `eval_events`.
"""

from __future__ import annotations

from synapse_backend.config import get_settings

from . import prompts
from .schemas import Lesson, QuizQuestion
from .teacher import build_backend


async def generate_quiz(lesson: Lesson, n: int = 2) -> list[QuizQuestion]:
    backend = build_backend(get_settings().effective_planner_brain)
    raw = await backend.complete_json(
        system=prompts.QUIZ_GEN_SYSTEM.format(n=n),
        user=prompts.quiz_gen_user(lesson.title, lesson.objectives, n),
        max_tokens=500,
    )
    items = raw.get("questions", []) if isinstance(raw, dict) else []
    out: list[QuizQuestion] = []
    for i, item in enumerate(items[:n], start=1):
        prompt = item.get("prompt") if isinstance(item, dict) else str(item)
        if prompt:
            out.append(QuizQuestion(id=f"q{i}", prompt=prompt))
    return out


async def grade_quiz(lesson: Lesson, qa: list[dict]) -> float:
    """Score 0..1 of objective mastery from quiz answers."""
    if not any((x.get("answer") or "").strip() for x in qa):
        return 0.0
    backend = build_backend(get_settings().effective_planner_brain)
    raw = await backend.complete_json(
        system=prompts.QUIZ_GRADE_SYSTEM,
        user=prompts.quiz_grade_user(lesson.title, lesson.objectives, qa),
        max_tokens=200,
    )
    try:
        score = float(raw.get("score", 0.0))
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, score))
