"""MongoDB documents (Beanie). NOT SQL — these are document collections.

The course tree is stored as one `Course` document (read as a unit); mutable
progress lives in `LearnerState`; transcripts in `LessonSession`; RAG chunks in
`CorpusChunk`. Structural shapes are reused from `brain.schemas` so there's one
source of truth for the syllabus.
"""

from __future__ import annotations

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import IndexModel

from synapse_backend.brain.schemas import CoursePlan, GoalSpec


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Learner(Document):
    name: str = "local"
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "learners"


class Goal(Document):
    learner_id: str
    raw_text: str = ""
    spec: GoalSpec
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "goals"


class Course(Document):
    learner_id: str
    goal_id: str
    plan: CoursePlan
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "courses"


class LearnerState(Document):
    """Mutable progress for one learner+course. The gating/SRS source of truth."""

    learner_id: str
    course_id: str
    # skill_id -> {mastery, attempts, last_seen, srs_due}
    skills: dict[str, dict] = Field(default_factory=dict)
    # lesson_id -> "locked" | "available" | "in_progress" | "mastered"
    lessons: dict[str, str] = Field(default_factory=dict)
    error_patterns: list[str] = Field(default_factory=list)
    position: dict = Field(default_factory=dict)  # {module_id, lesson_id}
    updated_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "learner_state"


class LessonSession(Document):
    learner_id: str
    course_id: str
    lesson_id: str
    transcript: list[dict] = Field(default_factory=list)
    recap: dict | None = None
    started_at: datetime = Field(default_factory=_utcnow)
    ended_at: datetime | None = None

    class Settings:
        name = "lesson_sessions"


class CorpusChunk(Document):
    """A RAG chunk: vetted text + its embedding. Vector search lives in vectors.py."""

    scope: str  # "pack:<id>" or "course:<id>" — partitions retrieval
    text: str
    embedding: list[float]
    source: str = ""
    metadata: dict = Field(default_factory=dict)

    class Settings:
        name = "corpus_chunks"
        indexes = [IndexModel("scope")]


class ClassroomArtifact(Document):
    """Cached generated classroom content (board, glossary) per lesson, so the
    immersive view loads instantly and doesn't regenerate on every open."""

    course_id: str
    lesson_id: str
    kind: str  # "board" | "glossary"
    payload: dict
    created_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "classroom_artifacts"
        indexes = [IndexModel([("course_id", 1), ("lesson_id", 1), ("kind", 1)])]


ALL_DOCUMENTS = [
    Learner, Goal, Course, LearnerState, LessonSession, CorpusChunk, ClassroomArtifact,
]
