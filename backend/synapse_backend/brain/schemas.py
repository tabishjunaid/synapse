"""Pydantic schemas for the teaching brain.

These are the structured shapes the planner/grader produce and the Mongo
documents embed — one source of truth for the course tree. Kept free of any
store or backend imports so both layers can depend on it.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Level = Literal["beginner", "intermediate", "advanced"]
LessonShape = Literal["intro", "worked", "guided", "review", "project"]

_SHAPES = {"intro", "worked", "guided", "review", "project"}
_SHAPE_SYNONYMS = {
    "introduction": "intro", "concept": "intro", "lecture": "intro",
    "worked_example": "worked", "example": "worked", "demo": "worked",
    "practice": "guided", "guided_practice": "guided", "exercise": "guided",
    "review_session": "review", "recap": "review", "assessment": "review",
    "application": "project", "capstone": "project", "scenario": "project",
}


def _as_str(x: object) -> str:
    if isinstance(x, str):
        return x
    if isinstance(x, dict):
        return str(x.get("name") or x.get("text") or x.get("skill") or x)
    return str(x)


# ---- goal intake -----------------------------------------------------------


class GoalSpec(BaseModel):
    """What the learner wants — the input to course formulation."""

    subject: str
    target_outcome: str = Field(description="Observable end goal, e.g. 'hold a 10-min travel chat'")
    level: Level = "beginner"
    minutes_per_week: int = 120
    horizon: str = Field(default="8 weeks", description="Time horizon, free text")
    motivation: str = ""


# ---- placement diagnostic --------------------------------------------------


class PlacementQuestion(BaseModel):
    id: str = ""
    prompt: str
    skill: str = ""


class PlacementResult(BaseModel):
    """Seeds the learner model + where the course starts."""

    estimated_level: Level = "beginner"
    known_skills: list[str] = Field(default_factory=list)
    notes: str = ""


class QuizQuestion(BaseModel):
    id: str = ""
    prompt: str


# ---- the course tree (planner output, also embedded in the Course doc) ------


class Skill(BaseModel):
    id: str = ""
    name: str
    mastery_criterion: float = 0.9


class Grounding(BaseModel):
    corpus_ref: str | None = None
    sources: list[str] = Field(default_factory=list)
    grounded: bool = False


class Lesson(BaseModel):
    id: str = ""
    order: int = 0
    title: str
    shape: LessonShape = "intro"
    objectives: list[str] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)
    review_skills: list[str] = Field(default_factory=list)
    est_minutes: int = 20
    grounding: Grounding = Field(default_factory=Grounding)

    # Small models emit skills as bare strings and loose shape labels. Coerce
    # rather than reject — the free local model must still produce a usable course.
    @field_validator("skills", mode="before")
    @classmethod
    def _coerce_skills(cls, v):
        # Pass through dicts and already-built Skill instances; only bare strings
        # (what weak models emit) get wrapped. Stringifying a Skill would mangle it.
        if isinstance(v, list):
            return [x if isinstance(x, (dict, Skill)) else {"name": _as_str(x)} for x in v]
        return v

    @field_validator("objectives", "prerequisites", "review_skills", mode="before")
    @classmethod
    def _coerce_str_list(cls, v):
        return [_as_str(x) for x in v] if isinstance(v, list) else v

    @field_validator("shape", mode="before")
    @classmethod
    def _coerce_shape(cls, v):
        if not isinstance(v, str):
            return "intro"
        s = v.strip().lower().replace(" ", "_")
        return s if s in _SHAPES else _SHAPE_SYNONYMS.get(s, "intro")


class Module(BaseModel):
    id: str = ""
    order: int = 0
    title: str
    goal: str = ""
    lessons: list[Lesson] = Field(default_factory=list)


class Pacing(BaseModel):
    sessions_per_week: int = 3
    minutes_per_session: int = 40
    target_done_date: str | None = None
    calendar: list[dict] = Field(default_factory=list)


class CoursePlan(BaseModel):
    """The generated syllabus — the heart of course formulation."""

    title: str
    summary: str = ""
    target_outcome: str = ""
    est_hours: float = 0.0
    modules: list[Module] = Field(default_factory=list)
    pacing: Pacing = Field(default_factory=Pacing)


# ---- lesson assessment (grader output) -------------------------------------


class SkillScore(BaseModel):
    skill_id: str
    mastery: float = Field(ge=0.0, le=1.0)
    evidence: str = ""


class Recap(BaseModel):
    covered: str = ""
    to_practise: str = ""
    next_time: str = ""


class LessonAssessment(BaseModel):
    skills: list[SkillScore] = Field(default_factory=list)
    recap: Recap = Field(default_factory=Recap)


# ---- between-turns planner (live, Opus) -------------------------------------


class BetweenTurnsUpdate(BaseModel):
    """The between-turns planner's live re-read of the running session.

    Produced on the stronger planner brain, alongside the fast path (not inside
    the speech round-trip). Drives live learner-model updates + a one-line focus
    steer the fast path folds into its next turns.
    """

    skills: list[SkillScore] = Field(default_factory=list)
    focus: str = ""  # one-line steer for the live tutor's next turns
    ready_to_check: bool = False  # learner has demonstrated the objectives
