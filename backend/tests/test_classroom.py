"""Classroom backend — packs, constellation mapping, board caching, writing fallback."""

from synapse_backend import courses, packs
from synapse_backend.brain import writing
from synapse_backend.brain.planner import _assign_ids
from synapse_backend.brain.schemas import CoursePlan, Lesson, Module, Skill
from synapse_backend.stores.documents import Course, LearnerState

PLAN = CoursePlan(title="T", modules=[
    Module(title="M1", lessons=[
        Lesson(title="L1", skills=[Skill(name="a")]),
        Lesson(title="L2", skills=[Skill(name="b")]),
    ]),
])
_assign_ids(PLAN)

PERSONA_KEYS = {
    "id", "name", "subject", "glyph", "accent", "accent2", "glow", "fontDisplay",
    "dir", "density", "greeting", "openingLine", "voiceHint", "sttTier", "ttsTier",
}


def test_knowledge_packs_match_frontend_shape():
    p = packs.list_packs()
    assert len(p) >= 4
    for pack in p:
        assert PERSONA_KEYS <= set(pack), f"missing keys: {PERSONA_KEYS - set(pack)}"
        assert pack["dir"] in ("ltr", "rtl")
        assert pack["sttTier"] in ("on-device", "server")


async def test_constellation_statuses_and_layout(db):
    course = Course(learner_id="x", goal_id="g", plan=PLAN.model_copy(deep=True))
    state = LearnerState(
        learner_id="x", course_id="c",
        skills={"m1l1s1": {"mastery": 0.95}},
        lessons={"m1l1": "mastered", "m1l2": "available"},
    )
    c = courses.constellation(course, state, current_lesson_id="m1l2")
    nodes = {n["id"]: n for n in c["skills"]}

    assert nodes["m1l1s1"]["status"] == "mastered"
    assert nodes["m1l2s1"]["status"] == "current"
    assert nodes["m1l1s1"]["label"] == "a"
    assert c["edges"] == [{"from": "m1l1s1", "to": "m1l2s1"}]
    assert all(0.0 <= n["x"] <= 1.0 and 0.0 <= n["y"] <= 1.0 for n in c["skills"])


async def test_constellation_due_when_srs_lapsed(db):
    course = Course(learner_id="x", goal_id="g", plan=PLAN.model_copy(deep=True))
    state = LearnerState(
        learner_id="x", course_id="c",
        skills={"m1l1s1": {"mastery": 0.95, "srs_due": 1.0}},  # due long ago
        lessons={"m1l1": "mastered"},
    )
    nodes = {n["id"]: n for n in courses.constellation(course, state)["skills"]}
    assert nodes["m1l1s1"]["status"] == "due"


async def test_board_is_generated_once_then_cached(db, monkeypatch):
    calls = {"n": 0}

    async def fake_board(lesson, subject=""):
        calls["n"] += 1
        return {"title": "T", "diagram": "", "math": None, "note": "n"}

    monkeypatch.setattr(courses.classroom_gen, "generate_board", fake_board)
    course = Course(learner_id="x", goal_id="g", plan=PLAN.model_copy(deep=True))
    await course.insert()
    _, lesson = courses.find_lesson(course, "m1l1")

    first = await courses.get_board(course, lesson, "math")
    second = await courses.get_board(course, lesson, "math")
    assert first == second
    assert calls["n"] == 1  # second call served from cache


async def test_writing_check_degrades_without_vision_model():
    res = await writing.check_writing("data:image/png;base64,AAAA", None)
    assert "vision model" in res["feedback"].lower()
    assert res["score"] is None
    assert res["annotation"] is None
