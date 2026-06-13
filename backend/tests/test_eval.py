"""Quiz grading + evaluation-loop summary (no live model / no QuestDB)."""

from synapse_backend import courses
from synapse_backend.brain import quiz
from synapse_backend.brain.schemas import Lesson


async def test_grade_quiz_blank_is_zero_without_model():
    lesson = Lesson(title="L", objectives=["add fractions"])
    score = await quiz.grade_quiz(lesson, [{"question": "q", "answer": ""}])
    assert score == 0.0


async def test_eval_summary_computes_gain(monkeypatch):
    async def fake_query(sql):
        return {"dataset": [["m1l1", "pre", 0.2], ["m1l1", "post", 0.8],
                            ["m1l2", "pre", 0.5], ["m1l2", "post", 0.5]]}

    monkeypatch.setattr(courses.metrics, "query", fake_query)
    summary = await courses.eval_summary()

    by_lesson = {l["lesson_id"]: l for l in summary["lessons"]}
    assert by_lesson["m1l1"]["gain"] == 0.6  # 0.8 - 0.2
    assert by_lesson["m1l2"]["gain"] == 0.0
    assert summary["overall_gain"] == 0.3  # mean of 0.6 and 0.0
    assert summary["n"] == 2


async def test_eval_summary_handles_questdb_down(monkeypatch):
    async def boom(sql):
        raise RuntimeError("questdb down")

    monkeypatch.setattr(courses.metrics, "query", boom)
    summary = await courses.eval_summary()
    assert summary == {"lessons": [], "overall_gain": None, "n": 0}
