"""Planner: structured course generation + tolerant parsing, no live model."""

import pytest

from synapse_backend.brain import planner
from synapse_backend.brain.schemas import CoursePlan, GoalSpec

# A canned reply shaped like a weak local model's output: skills as bare strings,
# a loose shape label, objectives present — exercises the coercion path.
CANNED = {
    "title": "Conversational Spanish for Travelers",
    "summary": "Speak basic travel Spanish.",
    "target_outcome": "Hold a 10-minute conversation",
    "est_hours": 24,
    "pacing": {"sessions_per_week": 4, "minutes_per_session": 30, "target_done_date": None},
    "modules": [
        {"title": "Greetings", "goal": "Say hello", "lessons": [
            {"title": "Salutations", "shape": "introduction",  # loose synonym
             "objectives": ["Greet someone"], "skills": ["saludos", "presentarse"]},
        ]},
        {"title": "Ordering food", "goal": "Order a meal", "lessons": [
            {"title": "At a restaurant", "shape": "worked",
             "objectives": ["Order a dish"], "skills": ["comida"], "review_skills": ["saludos"]},
        ]},
    ],
}


class FakeBackend:
    name = "fake"

    async def complete_json(self, *, system, user, max_tokens):
        return CANNED


@pytest.fixture
def fake_backend(monkeypatch):
    monkeypatch.setattr(planner, "build_backend", lambda brain: FakeBackend())


async def test_generate_course_coerces_and_assigns_ids(fake_backend):
    goal = GoalSpec(subject="Spanish", target_outcome="chat", level="beginner")
    plan = await planner.generate_course(goal)

    assert isinstance(plan, CoursePlan)
    assert len(plan.modules) == 2
    # loose "introduction" coerced to a valid shape
    assert plan.modules[0].lessons[0].shape == "intro"
    # bare-string skills coerced into Skill objects with assigned ids
    skills = plan.modules[0].lessons[0].skills
    assert [s.name for s in skills] == ["saludos", "presentarse"]
    assert plan.modules[0].id == "m1"
    assert plan.modules[0].lessons[0].id == "m1l1"
    assert skills[0].id == "m1l1s1"
    assert plan.modules[1].lessons[0].review_skills == ["saludos"]


def test_quick_placement_uses_level():
    goal = GoalSpec(subject="x", target_outcome="y", level="intermediate")
    assert planner.quick_placement(goal).estimated_level == "intermediate"


async def test_assess_placement_blank_falls_back_without_calling_model():
    # All-blank answers → self-report, no model call (would raise if attempted).
    goal = GoalSpec(subject="x", target_outcome="y", level="advanced")
    res = await planner.assess_placement(goal, [{"question": "q1", "answer": ""}])
    assert res.estimated_level == "advanced"


async def test_generate_placement_questions_assigns_ids(monkeypatch):
    class FB:
        async def complete_json(self, **kwargs):
            return {"questions": [{"prompt": "What is a variable?"}, {"prompt": "Write a loop."}]}

    monkeypatch.setattr(planner, "build_backend", lambda brain: FB())
    qs = await planner.generate_placement_questions(GoalSpec(subject="x", target_outcome="y"))
    assert [q.id for q in qs] == ["q1", "q2"]
    assert qs[0].prompt == "What is a variable?"
