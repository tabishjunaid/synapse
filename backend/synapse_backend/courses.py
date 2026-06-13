"""Course service — formulation, persistence, progress, and gating.

Sits between the HTTP layer (gateway/api.py) and the stores/brain. Keeps the
router thin. Single local learner for now (no auth).
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from dataclasses import dataclass

from synapse_backend.config import get_settings
from synapse_backend.brain import classroom as classroom_gen
from synapse_backend.brain import prompts, quiz, rag
from synapse_backend.brain.grader import assess_lesson
from synapse_backend.brain.planner import generate_course, quick_placement
from synapse_backend.brain.schemas import CoursePlan, GoalSpec, Lesson, Module, QuizQuestion
from synapse_backend.stores import metrics
from synapse_backend.stores.documents import (
    ClassroomArtifact,
    CorpusChunk,
    Course,
    Goal,
    Learner,
    LearnerState,
    LessonSession,
)

MASTERY_THRESHOLD = 0.8  # prototype bar; concept doc's target is ~0.9

# Spaced-repetition intervals (days) — a Leitner-style ladder. Each successful
# review pushes a skill to the next box; `srs_due` is stored as an epoch float to
# sidestep naive/aware datetime comparison pitfalls from Mongo.
SRS_INTERVALS_DAYS = [1, 3, 7, 16, 35]
MAX_REVIEW_WARMUP = 3


def _schedule_review(entry: dict, now_ts: float) -> None:
    box = min(entry.get("srs_box", -1) + 1, len(SRS_INTERVALS_DAYS) - 1)
    entry["srs_box"] = box
    entry["srs_due"] = now_ts + SRS_INTERVALS_DAYS[box] * 86400.0


async def get_local_learner() -> Learner:
    learner = await Learner.find_one(Learner.name == "local")
    if learner is None:
        learner = Learner(name="local")
        await learner.insert()
    return learner


async def create_goal(spec: GoalSpec, raw_text: str = "") -> Goal:
    learner = await get_local_learner()
    goal = Goal(learner_id=str(learner.id), spec=spec, raw_text=raw_text or spec.target_outcome)
    await goal.insert()
    return goal


def ordered_lessons(plan: CoursePlan) -> list[tuple[Module, Lesson]]:
    pairs: list[tuple[Module, Lesson]] = []
    for module in plan.modules:
        for lesson in module.lessons:
            pairs.append((module, lesson))
    return pairs


async def generate_and_store_course(goal: Goal, placement=None) -> Course:
    """Formulate a syllabus for a goal, persist it, and seed the learner state."""
    placement = placement or quick_placement(goal.spec)
    # Optional grounding: empty for arbitrary subjects with no curated corpus.
    scope = f"course:{goal.id}"
    grounding = await rag.ground(scope, f"{goal.spec.subject}: {goal.spec.target_outcome}", k=4)

    plan = await generate_course(goal.spec, placement=placement, grounding_context=grounding)
    if grounding:
        for _, lesson in ordered_lessons(plan):
            lesson.grounding.grounded = True

    course = Course(learner_id=goal.learner_id, goal_id=str(goal.id), plan=plan)
    await course.insert()
    await _init_state(course)
    return course


async def _init_state(course: Course) -> LearnerState:
    pairs = ordered_lessons(course.plan)
    skills = {
        s.id: {"mastery": 0.0, "attempts": 0, "last_seen": None, "srs_due": None}
        for _, lesson in pairs
        for s in lesson.skills
    }
    lessons = {lesson.id: "locked" for _, lesson in pairs}
    position: dict = {}
    if pairs:
        first_module, first_lesson = pairs[0]
        lessons[first_lesson.id] = "available"
        position = {"module_id": first_module.id, "lesson_id": first_lesson.id}

    state = LearnerState(
        learner_id=course.learner_id,
        course_id=str(course.id),
        skills=skills,
        lessons=lessons,
        position=position,
    )
    await state.insert()
    return state


async def resolve_corpus_scope(goal_id: str | None, scope: str | None) -> str | None:
    """Resolve a corpus scope: an explicit `scope` wins; else a `goal_id` becomes
    "course:<goal_id>" (matching generation + lesson retrieval). None if a given
    goal doesn't exist or nothing usable was provided."""
    if scope:
        return scope
    if goal_id:
        goal = await Goal.get(goal_id)
        if goal is not None:
            return f"course:{goal_id}"
    return None


async def ingest_corpus(
    text: str, *, source: str = "", goal_id: str | None = None, scope: str | None = None
) -> dict | None:
    """Add a vetted source to a RAG corpus so the planner/teacher can ground on it.

    Pass an explicit `scope` ("pack:<id>" for a shared corpus) or a `goal_id`
    (resolved to "course:<goal_id>"). Ingest *before* generating the course so the
    syllabus is grounded. Returns the scope + chunks added, or None if a
    referenced goal doesn't exist.
    """
    resolved = await resolve_corpus_scope(goal_id, scope)
    if resolved is None:
        return None
    added = await rag.ingest(resolved, text, source)
    return {"scope": resolved, "chunks_added": added}


async def corpus_stats(scope: str) -> dict:
    """How many chunks a scope holds — for a corpus-management surface."""
    n = await CorpusChunk.find(CorpusChunk.scope == scope).count()
    return {"scope": scope, "chunks": n}


async def delete_corpus(scope: str) -> dict:
    """Drop every chunk in a scope (e.g. to re-ingest a corrected corpus)."""
    res = await CorpusChunk.find(CorpusChunk.scope == scope).delete()
    deleted = getattr(res, "deleted_count", 0) or 0
    return {"scope": scope, "deleted": deleted}


async def current_course(learner_id: str) -> Course | None:
    return (
        await Course.find(Course.learner_id == learner_id)
        .sort(-Course.created_at)
        .first_or_none()
    )


async def get_state(course: Course) -> LearnerState | None:
    return await LearnerState.find_one(LearnerState.course_id == str(course.id))


def _lesson_mastery(lesson: Lesson, state: LearnerState) -> float:
    if not lesson.skills:
        return 0.0
    vals = [state.skills.get(s.id, {}).get("mastery", 0.0) for s in lesson.skills]
    return round(sum(vals) / len(vals), 3)


async def course_view(course: Course, state: LearnerState) -> dict:
    """Dashboard shape: the syllabus tree fused with progress + the next lesson."""
    pairs = ordered_lessons(course.plan)
    next_lesson_id = next(
        (l.id for _, l in pairs if state.lessons.get(l.id) in ("available", "in_progress")),
        None,
    )
    modules = []
    for module in course.plan.modules:
        modules.append({
            "id": module.id,
            "title": module.title,
            "goal": module.goal,
            "lessons": [{
                "id": l.id,
                "order": l.order,
                "title": l.title,
                "shape": l.shape,
                "objectives": l.objectives,
                "skills": [{"id": s.id, "name": s.name} for s in l.skills],
                "est_minutes": l.est_minutes,
                "grounded": l.grounding.grounded,
                "status": state.lessons.get(l.id, "locked"),
                "mastery": _lesson_mastery(l, state),
            } for l in module.lessons],
        })
    return {
        "course_id": str(course.id),
        "title": course.plan.title,
        "summary": course.plan.summary,
        "target_outcome": course.plan.target_outcome,
        "est_hours": course.plan.est_hours,
        "pacing": course.plan.pacing.model_dump(),
        "modules": modules,
        "next_lesson_id": next_lesson_id,
        "reviews_due": len(due_review_names(course, state, limit=999)),
    }


def due_review_names(course: Course, state: LearnerState, exclude_lesson_id: str = "",
                     now_ts: float | None = None, limit: int = MAX_REVIEW_WARMUP) -> list[str]:
    """Names of mastered skills whose spaced-review is due, for warm-up retrieval."""
    now_ts = now_ts if now_ts is not None else _utcnow().timestamp()
    out: list[str] = []
    for _, lesson in ordered_lessons(course.plan):
        if lesson.id == exclude_lesson_id:
            continue
        for skill in lesson.skills:
            entry = state.skills.get(skill.id, {})
            due = entry.get("srs_due")
            if due is not None and due <= now_ts and entry.get("mastery", 0.0) >= MASTERY_THRESHOLD:
                out.append(skill.name)
    return out[:limit]


def constellation(course: Course, state: LearnerState, current_lesson_id: str = "",
                  max_nodes: int = 28) -> dict:
    """The course's skill graph as a star map: SkillNode[] + SkillEdge[].

    Real learner data — mastery, SRS due-ness, and lesson gating drive each star's
    status; no LLM. Skills are laid out along the learning path in a 0..1 box.
    """
    now_ts = _utcnow().timestamp()
    if not current_lesson_id:
        pairs = ordered_lessons(course.plan)
        current_lesson_id = next(
            (l.id for _, l in pairs if state.lessons.get(l.id) in ("available", "in_progress")),
            "",
        )

    flat: list[tuple[Lesson, object]] = [
        (lesson, skill)
        for _, lesson in ordered_lessons(course.plan)
        for skill in lesson.skills
    ][:max_nodes]

    nodes = []
    n = max(1, len(flat))
    for i, (lesson, skill) in enumerate(flat):
        entry = state.skills.get(skill.id, {})
        mastery = float(entry.get("mastery", 0.0))
        due = entry.get("srs_due")
        lesson_status = state.lessons.get(lesson.id, "locked")
        if mastery >= MASTERY_THRESHOLD:
            status = "due" if (due is not None and due <= now_ts) else "mastered"
        elif lesson.id == current_lesson_id or lesson_status in ("available", "in_progress"):
            status = "current"
        else:
            status = "locked"
        nodes.append({
            "id": skill.id,
            "label": skill.name,
            "x": round(0.08 + 0.84 * (i / max(1, n - 1)), 4),
            "y": round(min(0.88, max(0.12, 0.5 + 0.3 * math.sin(i * 1.3))), 4),
            "status": status,
            "mastery": round(mastery, 3),
        })

    edges = [{"from": flat[i][1].id, "to": flat[i + 1][1].id} for i in range(len(flat) - 1)]
    return {"skills": nodes, "edges": edges}


async def _cached_artifact(course: Course, lesson: Lesson, kind: str, generate) -> dict:
    """Return cached classroom content for a lesson, generating + storing on miss."""
    cached = await ClassroomArtifact.find_one(
        ClassroomArtifact.course_id == str(course.id),
        ClassroomArtifact.lesson_id == lesson.id,
        ClassroomArtifact.kind == kind,
    )
    if cached is not None:
        return cached.payload
    payload = await generate()
    await ClassroomArtifact(
        course_id=str(course.id), lesson_id=lesson.id, kind=kind, payload=payload
    ).insert()
    return payload


async def get_board(course: Course, lesson: Lesson, subject: str = "") -> dict:
    return await _cached_artifact(
        course, lesson, "board", lambda: classroom_gen.generate_board(lesson, subject)
    )


async def get_glossary(course: Course, lesson: Lesson) -> dict:
    return await _cached_artifact(
        course, lesson, "glossary", lambda: classroom_gen.generate_glossary(lesson)
    )


def find_lesson(course: Course, lesson_id: str) -> tuple[Module, Lesson] | None:
    for module, lesson in ordered_lessons(course.plan):
        if lesson.id == lesson_id:
            return module, lesson
    return None


@dataclass
class LessonRuntime:
    system: str
    learner_id: str
    course_id: str
    lesson_id: str
    lesson: Lesson  # carried so the gateway can enable the between-turns coach


async def lesson_runtime(lesson_id: str) -> LessonRuntime | None:
    """Build the lesson-directed system prompt + ids for a live WS session.

    Also marks an `available` lesson `in_progress` so the dashboard reflects that
    the learner has started it.
    """
    learner = await get_local_learner()
    course = await current_course(str(learner.id))
    if course is None:
        return None
    found = find_lesson(course, lesson_id)
    if found is None:
        return None
    module, lesson = found
    state = await get_state(course)

    masteries = {
        s.name: state.skills.get(s.id, {}).get("mastery", 0.0) for s in lesson.skills
    }
    review_due = due_review_names(course, state, exclude_lesson_id=lesson_id)
    grounding = ""
    if lesson.grounding.grounded:
        grounding = await rag.ground(f"course:{course.goal_id}", lesson.title, k=3)

    system = prompts.build_lesson_system(
        course_title=course.plan.title,
        module_title=module.title,
        lesson_title=lesson.title,
        shape=lesson.shape,
        objectives=lesson.objectives,
        skills=masteries,
        grounding=grounding,
        review_due=review_due,
    )

    if state.lessons.get(lesson_id) == "available":
        state.lessons[lesson_id] = "in_progress"
        state.updated_at = _utcnow()
        await state.save()

    return LessonRuntime(
        system=system,
        learner_id=str(learner.id),
        course_id=str(course.id),
        lesson_id=lesson_id,
        lesson=lesson,
    )


async def lesson_quiz(lesson_id: str, n: int = 2) -> list[QuizQuestion] | None:
    learner = await get_local_learner()
    course = await current_course(str(learner.id))
    if course is None:
        return None
    found = find_lesson(course, lesson_id)
    if found is None:
        return None
    return await quiz.generate_quiz(found[1], n=n)


async def record_pre_quiz(lesson_id: str, qa: list[dict]) -> dict | None:
    """Grade a pre-lesson quiz and log it as the 'pre' point of the eval loop."""
    learner = await get_local_learner()
    course = await current_course(str(learner.id))
    if course is None:
        return None
    found = find_lesson(course, lesson_id)
    if found is None:
        return None
    score = await quiz.grade_quiz(found[1], qa)
    metrics.record_eval(learner_id=str(learner.id), lesson_id=lesson_id, phase="pre", score=score)
    return {"score": score}


async def _latest_pre_score(learner_id: str, lesson_id: str) -> float | None:
    if not (learner_id.isalnum() and lesson_id.replace("_", "").isalnum()):
        return None  # ids are server-generated; refuse anything odd before SQL
    table = get_settings().questdb_table_prefix + "eval_events"
    sql = (
        f"SELECT score FROM {table} WHERE learner_id = '{learner_id}' "
        f"AND lesson_id = '{lesson_id}' AND phase = 'pre' ORDER BY timestamp DESC LIMIT 1"
    )
    try:
        res = await metrics.query(sql)
        rows = res.get("dataset") or []
        return float(rows[0][0]) if rows else None
    except Exception:
        return None


async def eval_summary() -> dict:
    """Aggregate the d≈0.8 evaluation loop from QuestDB eval_events."""
    table = get_settings().questdb_table_prefix + "eval_events"
    sql = f"SELECT lesson_id, phase, avg(score) FROM {table} GROUP BY lesson_id, phase"
    try:
        res = await metrics.query(sql)
        rows = res.get("dataset") or []
    except Exception:
        return {"lessons": [], "overall_gain": None, "n": 0}

    by_lesson: dict[str, dict] = {}
    for lesson_id, phase, avg in rows:
        by_lesson.setdefault(lesson_id, {})[phase] = avg
    lessons = []
    gains = []
    for lesson_id, phases in by_lesson.items():
        pre, post = phases.get("pre"), phases.get("post")
        gain = round(post - pre, 3) if (pre is not None and post is not None) else None
        if gain is not None:
            gains.append(gain)
        lessons.append({"lesson_id": lesson_id, "pre": pre, "post": post, "gain": gain})
    overall = round(sum(gains) / len(gains), 3) if gains else None
    return {"lessons": lessons, "overall_gain": overall, "n": len(gains)}


async def start_session(learner_id: str, course_id: str, lesson_id: str) -> LessonSession:
    session = LessonSession(learner_id=learner_id, course_id=course_id, lesson_id=lesson_id)
    await session.insert()
    return session


async def record_live_update(course_id: str, update) -> list[dict]:
    """Persist the between-turns planner's live mastery estimates mid-session.

    Monotonic (keeps the best demonstrated mastery), mirroring `complete_lesson`,
    so the learner model + skill constellation reflect progress live. Gating and
    SRS stay at completion; this only moves the estimates. Best-effort: returns
    the skills it touched (clamped mastery) for the gateway to echo to the UI.
    """
    state = await LearnerState.find_one(LearnerState.course_id == course_id)
    if state is None:
        return []
    now = _utcnow()
    touched: list[dict] = []
    for sig in update.skills:
        entry = state.skills.setdefault(sig.skill_id, {"mastery": 0.0, "attempts": 0})
        entry["mastery"] = max(entry.get("mastery", 0.0), sig.mastery)
        entry["last_seen"] = now
        touched.append({"skill_id": sig.skill_id, "mastery": entry["mastery"]})
    if touched:
        state.updated_at = now
        await state.save()
    return touched


async def latest_session(learner_id: str, lesson_id: str) -> LessonSession | None:
    return (
        await LessonSession.find(
            LessonSession.learner_id == learner_id,
            LessonSession.lesson_id == lesson_id,
        )
        .sort(-LessonSession.started_at)
        .first_or_none()
    )


async def complete_lesson(lesson_id: str, transcript: list[dict]) -> dict | None:
    """Grade the session → update mastery → gate the next lesson → recap.

    Prefers the teacher's own persisted transcript over the client-supplied one,
    so grading can't be driven by a tampered client. Returns None if there's no
    current course/lesson.
    """
    learner = await get_local_learner()
    course = await current_course(str(learner.id))
    if course is None:
        return None
    found = find_lesson(course, lesson_id)
    if found is None:
        return None
    _, lesson = found
    state = await get_state(course)

    session = await latest_session(str(learner.id), lesson_id)
    if session and session.transcript:
        transcript = session.transcript

    assessment = await assess_lesson(lesson, transcript)
    scored = {s.skill_id: s.mastery for s in assessment.skills}

    now_ts = _utcnow().timestamp()
    skill_results = []
    for skill in lesson.skills:
        mastery = scored.get(skill.id, 0.0)
        entry = state.skills.setdefault(skill.id, {"mastery": 0.0, "attempts": 0})
        # Keep the learner's best demonstrated mastery for the skill.
        entry["mastery"] = max(entry.get("mastery", 0.0), mastery)
        entry["attempts"] = entry.get("attempts", 0) + 1
        entry["last_seen"] = _utcnow()
        # A mastered skill enters the spaced-review schedule.
        if entry["mastery"] >= MASTERY_THRESHOLD:
            _schedule_review(entry, now_ts)
        metrics.record_mastery(
            learner_id=str(learner.id), course_id=str(course.id),
            skill_id=skill.id, mastery=entry["mastery"],
        )
        skill_results.append({"skill_id": skill.id, "name": skill.name, "mastery": entry["mastery"]})

    passed = bool(lesson.skills) and all(
        state.skills[s.id]["mastery"] >= MASTERY_THRESHOLD for s in lesson.skills
    )

    next_lesson_id = _gate(course, state, lesson_id, passed)
    state.updated_at = _utcnow()
    await state.save()

    recap = assessment.recap.model_dump()
    if session:
        session.recap = recap
        session.ended_at = _utcnow()
        await session.save()

    # Post measure for the eval loop = demonstrated mastery this session.
    post_score = sum(r["mastery"] for r in skill_results) / max(1, len(skill_results))
    metrics.record_eval(
        learner_id=str(learner.id), lesson_id=lesson_id, phase="post", score=post_score,
    )
    pre_score = await _latest_pre_score(str(learner.id), lesson_id)
    gain = round(post_score - pre_score, 3) if pre_score is not None else None
    return {
        "recap": recap,
        "skills": skill_results,
        "passed": passed,
        "next_lesson_id": next_lesson_id,
        "pre_score": pre_score,
        "post_score": round(post_score, 3),
        "gain": gain,
    }


def _gate(course: Course, state: LearnerState, lesson_id: str, passed: bool) -> str | None:
    """Apply mastery gating: mark this lesson and unlock the next in sequence."""
    pairs = ordered_lessons(course.plan)
    ids = [l.id for _, l in pairs]
    if passed:
        state.lessons[lesson_id] = "mastered"
        idx = ids.index(lesson_id)
        if idx + 1 < len(ids):
            nxt = ids[idx + 1]
            if state.lessons.get(nxt) == "locked":
                state.lessons[nxt] = "available"
            return nxt
        return None
    state.lessons[lesson_id] = "in_progress"
    return lesson_id


async def reset_learner(learner_id: str) -> None:
    await Course.find(Course.learner_id == learner_id).delete()
    await LearnerState.find(LearnerState.learner_id == learner_id).delete()
    await Goal.find(Goal.learner_id == learner_id).delete()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
