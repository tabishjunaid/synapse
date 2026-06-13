"""REST API for the course layer (goal → syllabus → dashboard → lesson).

Thin HTTP glue over `courses.py`. JSON in/out; the WebSocket lesson runtime lives
in `ws.py`.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from synapse_backend import courses
from synapse_backend.brain.schemas import GoalSpec

router = APIRouter(prefix="/api")


class GoalRequest(BaseModel):
    spec: GoalSpec
    raw_text: str = ""


class GoalResponse(BaseModel):
    goal_id: str
    learner_id: str


class PlacementAnswer(BaseModel):
    question: str
    answer: str = ""


class GenerateRequest(BaseModel):
    goal_id: str
    placement_answers: list[PlacementAnswer] = []


class PlacementRequest(BaseModel):
    goal_id: str


class TranscriptMessage(BaseModel):
    role: str
    content: str


class CompleteRequest(BaseModel):
    transcript: list[TranscriptMessage] = []


@router.post("/goal", response_model=GoalResponse)
async def create_goal(req: GoalRequest) -> GoalResponse:
    goal = await courses.create_goal(req.spec, req.raw_text)
    return GoalResponse(goal_id=str(goal.id), learner_id=goal.learner_id)


@router.post("/placement")
async def placement(req: PlacementRequest) -> dict:
    from synapse_backend.brain.planner import generate_placement_questions
    from synapse_backend.stores.documents import Goal

    goal = await Goal.get(req.goal_id)
    if goal is None:
        raise HTTPException(404, "goal not found")
    questions = await generate_placement_questions(goal.spec)
    return {"questions": [q.model_dump() for q in questions]}


@router.post("/course/generate")
async def generate(req: GenerateRequest) -> dict:
    from synapse_backend.brain.planner import assess_placement
    from synapse_backend.stores.documents import Goal

    goal = await Goal.get(req.goal_id)
    if goal is None:
        raise HTTPException(404, "goal not found")

    placement_result = None
    if req.placement_answers:
        placement_result = await assess_placement(
            goal.spec, [a.model_dump() for a in req.placement_answers]
        )
    try:
        course = await courses.generate_and_store_course(goal, placement=placement_result)
    except ValueError as exc:  # planner returned malformed JSON twice
        raise HTTPException(502, str(exc)) from exc
    state = await courses.get_state(course)
    return await courses.course_view(course, state)


class CorpusRequest(BaseModel):
    text: str
    source: str = ""
    # Supply exactly one: a goal_id (→ "course:<goal_id>") or an explicit scope
    # (e.g. "pack:arabic" for a corpus shared across that pack's courses).
    goal_id: str | None = None
    scope: str | None = None


@router.post("/corpus")
async def add_corpus(req: CorpusRequest) -> dict:
    if not req.text.strip():
        raise HTTPException(422, "text is empty")
    if not req.scope and not req.goal_id:
        raise HTTPException(422, "provide goal_id or scope")
    result = await courses.ingest_corpus(
        req.text, source=req.source, goal_id=req.goal_id, scope=req.scope
    )
    if result is None:
        raise HTTPException(404, "goal not found")
    return result


async def _resolve_corpus_scope(scope: str | None, goal_id: str | None) -> str:
    if not scope and not goal_id:
        raise HTTPException(422, "provide goal_id or scope")
    resolved = await courses.resolve_corpus_scope(goal_id, scope)
    if resolved is None:
        raise HTTPException(404, "goal not found")
    return resolved


@router.get("/corpus")
async def corpus_status(scope: str | None = None, goal_id: str | None = None) -> dict:
    return await courses.corpus_stats(await _resolve_corpus_scope(scope, goal_id))


@router.delete("/corpus")
async def remove_corpus(scope: str | None = None, goal_id: str | None = None) -> dict:
    return await courses.delete_corpus(await _resolve_corpus_scope(scope, goal_id))


@router.get("/course")
async def get_course() -> dict:
    learner = await courses.get_local_learner()
    course = await courses.current_course(str(learner.id))
    if course is None:
        return {"course": None}
    state = await courses.get_state(course)
    return {"course": await courses.course_view(course, state)}


@router.get("/lesson/{lesson_id}")
async def get_lesson(lesson_id: str) -> dict:
    learner = await courses.get_local_learner()
    course = await courses.current_course(str(learner.id))
    if course is None:
        raise HTTPException(404, "no course")
    found = courses.find_lesson(course, lesson_id)
    if found is None:
        raise HTTPException(404, "lesson not found")
    module, lesson = found
    state = await courses.get_state(course)
    return {
        "course_id": str(course.id),
        "course_title": course.plan.title,
        "module": {"id": module.id, "title": module.title, "goal": module.goal},
        "lesson": {
            "id": lesson.id,
            "title": lesson.title,
            "shape": lesson.shape,
            "objectives": lesson.objectives,
            "skills": [{"id": s.id, "name": s.name} for s in lesson.skills],
            "est_minutes": lesson.est_minutes,
            "status": state.lessons.get(lesson.id, "locked"),
            "mastery": courses._lesson_mastery(lesson, state),
        },
    }


class QuizGradeRequest(BaseModel):
    answers: list[PlacementAnswer] = []


@router.get("/lesson/{lesson_id}/quiz")
async def lesson_quiz(lesson_id: str) -> dict:
    questions = await courses.lesson_quiz(lesson_id)
    if questions is None:
        raise HTTPException(404, "no course or lesson")
    return {"questions": [q.model_dump() for q in questions]}


@router.post("/lesson/{lesson_id}/quiz/pre")
async def pre_quiz(lesson_id: str, req: QuizGradeRequest) -> dict:
    result = await courses.record_pre_quiz(lesson_id, [a.model_dump() for a in req.answers])
    if result is None:
        raise HTTPException(404, "no course or lesson")
    return result


@router.get("/eval/summary")
async def eval_summary() -> dict:
    return await courses.eval_summary()


@router.post("/lesson/{lesson_id}/complete")
async def complete(lesson_id: str, req: CompleteRequest) -> dict:
    result = await courses.complete_lesson(
        lesson_id, [m.model_dump() for m in req.transcript]
    )
    if result is None:
        raise HTTPException(404, "no course or lesson")
    return result


@router.post("/course/reset")
async def reset() -> dict:
    learner = await courses.get_local_learner()
    await courses.reset_learner(str(learner.id))
    return {"ok": True}
