"""Course service: formulation persistence + gating, against a test Mongo."""

from synapse_backend import courses
from synapse_backend.brain.planner import _assign_ids
from synapse_backend.brain.schemas import (
    CoursePlan,
    GoalSpec,
    Lesson,
    LessonAssessment,
    Module,
    Recap,
    Skill,
    SkillScore,
)

PLAN = CoursePlan(
    title="Test Course",
    summary="s",
    target_outcome="o",
    est_hours=10,
    modules=[
        Module(title="M1", lessons=[
            Lesson(title="L1", shape="intro", objectives=["o1"], skills=[Skill(name="a")]),
            Lesson(title="L2", shape="guided", objectives=["o2"], skills=[Skill(name="b")]),
        ]),
        Module(title="M2", lessons=[
            Lesson(title="L3", shape="project", objectives=["o3"], skills=[Skill(name="c")]),
        ]),
    ],
)


async def _fake_generate(spec, placement=None, grounding_context=""):
    plan = PLAN.model_copy(deep=True)
    _assign_ids(plan)
    return plan


async def _fake_ground(*args, **kwargs):
    return ""


async def test_generate_persists_and_gates(db, monkeypatch):
    monkeypatch.setattr(courses, "generate_course", _fake_generate)
    monkeypatch.setattr(courses.rag, "ground", _fake_ground)

    goal = await courses.create_goal(GoalSpec(subject="x", target_outcome="y"))
    course = await courses.generate_and_store_course(goal)
    state = await courses.get_state(course)
    view = await courses.course_view(course, state)

    # Only the very first lesson is open; the rest are gated.
    assert view["next_lesson_id"] == "m1l1"
    statuses = {l["id"]: l["status"] for m in view["modules"] for l in m["lessons"]}
    assert statuses == {"m1l1": "available", "m1l2": "locked", "m2l1": "locked"}
    # Every skill seeded at zero mastery.
    assert all(s["mastery"] == 0.0 for m in view["modules"] for s in [m["lessons"][0]])


async def test_complete_lesson_gates_next_on_mastery(db, monkeypatch):
    monkeypatch.setattr(courses, "generate_course", _fake_generate)
    monkeypatch.setattr(courses.rag, "ground", _fake_ground)

    async def fake_assess(lesson, transcript):
        return LessonAssessment(
            skills=[SkillScore(skill_id=s.id, mastery=0.95) for s in lesson.skills],
            recap=Recap(covered="c", to_practise="p", next_time="n"),
        )

    monkeypatch.setattr(courses, "assess_lesson", fake_assess)

    goal = await courses.create_goal(GoalSpec(subject="x", target_outcome="y"))
    await courses.generate_and_store_course(goal)

    result = await courses.complete_lesson("m1l1", [{"role": "user", "content": "I did it"}])
    assert result["passed"] is True
    assert result["next_lesson_id"] == "m1l2"

    # The next lesson is now unlocked; the completed one is mastered.
    learner = await courses.get_local_learner()
    course = await courses.current_course(str(learner.id))
    state = await courses.get_state(course)
    assert state.lessons["m1l1"] == "mastered"
    assert state.lessons["m1l2"] == "available"


async def test_complete_lesson_below_threshold_stays_locked(db, monkeypatch):
    monkeypatch.setattr(courses, "generate_course", _fake_generate)
    monkeypatch.setattr(courses.rag, "ground", _fake_ground)

    async def fake_assess(lesson, transcript):
        return LessonAssessment(
            skills=[SkillScore(skill_id=s.id, mastery=0.3) for s in lesson.skills],
            recap=Recap(),
        )

    monkeypatch.setattr(courses, "assess_lesson", fake_assess)

    goal = await courses.create_goal(GoalSpec(subject="x", target_outcome="y"))
    await courses.generate_and_store_course(goal)
    result = await courses.complete_lesson("m1l1", [{"role": "user", "content": "hmm"}])

    assert result["passed"] is False
    learner = await courses.get_local_learner()
    course = await courses.current_course(str(learner.id))
    state = await courses.get_state(course)
    assert state.lessons["m1l1"] == "in_progress"
    assert state.lessons["m1l2"] == "locked"


async def test_current_course_is_latest(db, monkeypatch):
    monkeypatch.setattr(courses, "generate_course", _fake_generate)
    monkeypatch.setattr(courses.rag, "ground", _fake_ground)

    goal = await courses.create_goal(GoalSpec(subject="x", target_outcome="y"))
    await courses.generate_and_store_course(goal)
    learner = await courses.get_local_learner()
    current = await courses.current_course(str(learner.id))
    assert current is not None
    assert current.plan.title == "Test Course"
