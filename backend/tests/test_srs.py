"""Spaced-review scheduling + due computation (pure, no DB)."""

from synapse_backend import courses
from synapse_backend.brain.planner import _assign_ids
from synapse_backend.brain.schemas import CoursePlan, Lesson, Module, Skill
from synapse_backend.stores.documents import Course, LearnerState

PLAN = CoursePlan(
    title="T",
    modules=[
        Module(title="M1", lessons=[
            Lesson(title="L1", skills=[Skill(name="a")]),
            Lesson(title="L2", skills=[Skill(name="b")]),
        ]),
    ],
)
_assign_ids(PLAN)


def _course():
    return Course(learner_id="x", goal_id="g", plan=PLAN.model_copy(deep=True))


def test_schedule_review_grows_interval():
    entry: dict = {"mastery": 0.9}
    courses._schedule_review(entry, now_ts=1000.0)
    assert entry["srs_box"] == 0
    first_due = entry["srs_due"]
    assert first_due == 1000.0 + courses.SRS_INTERVALS_DAYS[0] * 86400.0
    courses._schedule_review(entry, now_ts=2000.0)
    assert entry["srs_box"] == 1  # advanced a box → longer interval
    assert entry["srs_due"] - 2000.0 > first_due - 1000.0


def test_due_review_names_only_past_due_mastered(db):
    course = _course()
    now = 10_000.0
    state = LearnerState(learner_id="x", course_id="c", skills={
        "m1l1s1": {"mastery": 0.9, "srs_due": now - 1},   # due, mastered → included
        "m1l2s1": {"mastery": 0.9, "srs_due": now + 1000},  # not yet due → excluded
    })
    due = courses.due_review_names(course, state, now_ts=now)
    assert due == ["a"]


def test_due_review_excludes_current_lesson(db):
    course = _course()
    now = 10_000.0
    state = LearnerState(learner_id="x", course_id="c", skills={
        "m1l1s1": {"mastery": 0.9, "srs_due": now - 1},
    })
    assert courses.due_review_names(course, state, exclude_lesson_id="m1l1", now_ts=now) == []
