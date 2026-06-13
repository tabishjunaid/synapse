"""Between-turns planner: cadence, focus injection, live learner-model updates.

The planner brain is faked (no model call), so this asserts the wiring offline:
the coach runs on cadence, folds its focus into the next system prompt, filters
unknown skill ids, and persists monotonic mastery into the learner state.
"""

from synapse_backend import courses
from synapse_backend.brain import between_turns, prompts
from synapse_backend.brain.planner import _assign_ids
from synapse_backend.brain.schemas import (
    BetweenTurnsUpdate,
    CoursePlan,
    Lesson,
    Module,
    Skill,
    SkillScore,
)
from synapse_backend.brain.teacher import TeacherSession
from synapse_backend.stores.documents import Course, LearnerState

LESSON = Lesson(title="L1", shape="intro", objectives=["o1"], skills=[Skill(name="a")])
_assign_ids(CoursePlan(title="T", modules=[Module(title="M1", lessons=[LESSON])]))


def _session() -> TeacherSession:
    # No backend needed: fast_turn isn't called here, only the coach hooks.
    return TeacherSession(backend=object(), lesson=LESSON.model_copy(deep=True), coach_cadence=3)


async def test_coach_runs_only_on_cadence(monkeypatch):
    calls = {"n": 0}

    async def fake_plan(lesson, transcript):
        calls["n"] += 1
        return BetweenTurnsUpdate(focus="press on a")

    monkeypatch.setattr(between_turns, "plan_between_turns", fake_plan)
    s = _session()

    # Turns 1, 2 → no run (cadence 3); turn 3 → run.
    for t in (1, 2):
        s.turns = t
        assert await s.run_between_turns() is None
    s.turns = 3
    update = await s.run_between_turns()
    assert update is not None and calls["n"] == 1


async def test_focus_folds_into_next_system_prompt(monkeypatch):
    async def fake_plan(lesson, transcript):
        return BetweenTurnsUpdate(focus="have them produce a full sentence")

    monkeypatch.setattr(between_turns, "plan_between_turns", fake_plan)
    s = _session()
    s.turns = 3
    base = s._effective_system()
    assert "Coaching note" not in base  # no focus yet

    await s.run_between_turns()
    folded = s._effective_system()
    assert "have them produce a full sentence" in folded
    assert prompts.COACH_FOCUS.split("{")[0].strip() in folded


async def test_no_coach_without_lesson(monkeypatch):
    s = TeacherSession(backend=object(), lesson=None)
    s.turns = 3
    assert await s.run_between_turns() is None


def test_plan_drops_unknown_skill_ids(monkeypatch):
    # plan_between_turns filters to the lesson's real skill ids.
    import asyncio

    async def fake_complete_json(self, system, user, max_tokens):
        return {
            "skills": [
                {"skill_id": "m1l1s1", "mastery": 0.7},  # real
                {"skill_id": "ghost", "mastery": 0.9},  # invented
            ],
            "focus": "ok",
        }

    from synapse_backend.brain import backends

    monkeypatch.setattr(backends.OpenAICompatBackend, "complete_json", fake_complete_json)
    update = asyncio.run(between_turns.plan_between_turns(LESSON.model_copy(deep=True), []))
    assert [s.skill_id for s in update.skills] == ["m1l1s1"]


async def test_record_live_update_is_monotonic(db):
    plan = CoursePlan(title="T", modules=[Module(title="M1", lessons=[LESSON.model_copy(deep=True)])])
    _assign_ids(plan)
    course = Course(learner_id="x", goal_id="g", plan=plan)
    await course.insert()
    state = LearnerState(
        learner_id="x", course_id=str(course.id),
        skills={"m1l1s1": {"mastery": 0.6, "attempts": 1}},
    )
    await state.insert()

    update = BetweenTurnsUpdate(skills=[SkillScore(skill_id="m1l1s1", mastery=0.8)])
    touched = await courses.record_live_update(str(course.id), update)
    assert touched == [{"skill_id": "m1l1s1", "mastery": 0.8}]

    # A lower live estimate never lowers the demonstrated best.
    lower = BetweenTurnsUpdate(skills=[SkillScore(skill_id="m1l1s1", mastery=0.4)])
    touched = await courses.record_live_update(str(course.id), lower)
    assert touched == [{"skill_id": "m1l1s1", "mastery": 0.8}]
