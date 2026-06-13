"""REST endpoints powering the immersive Classroom view.

Backs the components that currently run on frontend mocks: the whiteboard
(per-lesson board), tap-to-deepen (glossary), the skill constellation (learner
model), the pack switcher (personas), and the writing canvas (vision review).
Shapes match the frontend interfaces exactly so the UI can swap mock → live.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from synapse_backend import courses, packs
from synapse_backend.brain.writing import check_writing
from synapse_backend.stores.documents import Goal

router = APIRouter(prefix="/api")


@router.get("/knowledge-packs")
async def knowledge_packs() -> dict:
    return {"packs": packs.list_packs()}


async def _resolve(lesson_id: str):
    """(course, module, lesson, state) for the current learner, or 404."""
    learner = await courses.get_local_learner()
    course = await courses.current_course(str(learner.id))
    if course is None:
        raise HTTPException(404, "no course")
    found = courses.find_lesson(course, lesson_id)
    if found is None:
        raise HTTPException(404, "lesson not found")
    module, lesson = found
    state = await courses.get_state(course)
    return course, module, lesson, state


@router.get("/lesson/{lesson_id}/board")
async def board(lesson_id: str) -> dict:
    course, _, lesson, _ = await _resolve(lesson_id)
    goal = await Goal.get(course.goal_id)
    subject = goal.spec.subject if goal else ""
    return await courses.get_board(course, lesson, subject)


@router.get("/lesson/{lesson_id}/glossary")
async def glossary(lesson_id: str) -> dict:
    course, _, lesson, _ = await _resolve(lesson_id)
    return await courses.get_glossary(course, lesson)


@router.get("/lesson/{lesson_id}/constellation")
async def constellation(lesson_id: str) -> dict:
    course, _, _, state = await _resolve(lesson_id)
    return courses.constellation(course, state, current_lesson_id=lesson_id)


class WritingCheckRequest(BaseModel):
    image: str  # canvas.toDataURL() — a data: URL
    lesson_id: str | None = None


@router.post("/writing-check")
async def writing_check(req: WritingCheckRequest) -> dict:
    lesson = None
    if req.lesson_id:
        learner = await courses.get_local_learner()
        course = await courses.current_course(str(learner.id))
        if course is not None:
            found = courses.find_lesson(course, req.lesson_id)
            if found is not None:
                lesson = found[1]
    return await check_writing(req.image, lesson)
