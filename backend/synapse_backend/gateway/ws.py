"""Phase 0 audio-gateway relay (Python).

This is the thin relay the plan budgets at ~200 lines: WebSocket termination
plus event routing between the client and the brain. It exists to measure
model-dominated latency; the Phase 1 Rust gateway (Axum + tokio) replaces it
behind the same protocol once Phase 0 has surfaced the real requirements
(barge-in, tier switching, reconnection).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from synapse_backend.brain.teacher import TeacherSession, TurnResult
from synapse_backend.stores import metrics

from .protocol import (
    ClientEvent,
    LearnerSkill,
    LearnerUpdate,
    ResetEvent,
    ServerError,
    SpeakDelta,
    TranscriptEvent,
    TurnEnd,
    TurnLatency,
    TurnStart,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_client_event = TypeAdapter(ClientEvent)


@router.websocket("/ws/session")
async def session_socket(ws: WebSocket) -> None:
    await ws.accept()

    # A lesson_id turns the generic loop into a lesson-directed session: the
    # teacher gets a prompt built from the lesson's objectives + current mastery.
    lesson_id = ws.query_params.get("lesson_id")
    learner_id = "anon"
    db_session = None  # the persisted LessonSession (lesson mode only)
    transcript: list[dict] = []
    courses = None
    if lesson_id:
        # Imported here so the /spike path never needs Mongo.
        from synapse_backend import courses

        runtime = await courses.lesson_runtime(lesson_id)
        if runtime is None:
            await ws.send_text(ServerError(message="Lesson not found.").model_dump_json())
            await ws.close()
            return
        # Pass the lesson so the between-turns planner can run alongside the fast
        # path and update the learner model live.
        session = TeacherSession(system=runtime.system, lesson=runtime.lesson)
        learner_id = runtime.learner_id
        db_session = await courses.start_session(learner_id, runtime.course_id, lesson_id)
    else:
        session = TeacherSession()

    turn_id = 0

    try:
        while True:
            raw = await ws.receive_text()
            try:
                event = _client_event.validate_json(raw)
            except ValidationError as exc:
                await ws.send_text(ServerError(message=f"bad event: {exc}").model_dump_json())
                continue

            if isinstance(event, ResetEvent):
                session.reset()
                continue

            assert isinstance(event, TranscriptEvent)
            turn_id += 1
            await ws.send_text(
                TurnStart(turn_id=turn_id, speech_end_ts=event.speech_end_ts).model_dump_json()
            )

            try:
                async for item in session.fast_turn(event.text):
                    if isinstance(item, TurnResult):
                        metrics.record_turn(
                            learner_id=learner_id,
                            lesson_id=lesson_id or "",
                            first_token_ms=item.first_token_ms,
                            total_ms=item.total_ms,
                            input_tokens=item.input_tokens,
                            output_tokens=item.output_tokens,
                        )
                        # Persist the turn so the teacher owns the record the
                        # grader reads (not the client). Best-effort.
                        if db_session is not None:
                            transcript.append({"role": "user", "content": event.text})
                            transcript.append({"role": "assistant", "content": item.full_text})
                            db_session.transcript = transcript
                            try:
                                await db_session.save()
                            except Exception:
                                logger.warning("failed to persist lesson turn", exc_info=True)
                        await ws.send_text(
                            TurnEnd(
                                turn_id=turn_id,
                                full_text=item.full_text,
                                latency=TurnLatency(
                                    first_token_ms=item.first_token_ms,
                                    total_ms=item.total_ms,
                                    input_tokens=item.input_tokens,
                                    output_tokens=item.output_tokens,
                                ),
                                speech_end_ts=event.speech_end_ts,
                            ).model_dump_json()
                        )
                    else:
                        await ws.send_text(
                            SpeakDelta(turn_id=turn_id, text=item).model_dump_json()
                        )

                # Between turns (reply already shipped): in lesson mode, let the
                # stronger planner brain re-read the session and update the learner
                # model live. Best-effort — the coach never breaks a lesson.
                if db_session is not None:
                    try:
                        update = await session.run_between_turns()
                        if update is not None:
                            touched = await courses.record_live_update(
                                runtime.course_id, update
                            )
                            if touched or update.focus or update.ready_to_check:
                                await ws.send_text(
                                    LearnerUpdate(
                                        turn_id=turn_id,
                                        skills=[LearnerSkill(**t) for t in touched],
                                        focus=update.focus,
                                        ready_to_check=update.ready_to_check,
                                    ).model_dump_json()
                                )
                    except Exception:
                        logger.warning("between-turns update failed", exc_info=True)
            except Exception:
                logger.exception("fast turn failed")
                await ws.send_text(
                    ServerError(message="The teacher hit an error on that turn.").model_dump_json()
                )
    except WebSocketDisconnect:
        logger.info("session disconnected")
    finally:
        if db_session is not None and courses is not None:
            from datetime import datetime, timezone

            db_session.ended_at = datetime.now(timezone.utc)
            try:
                await db_session.save()
            except Exception:
                logger.warning("failed to finalize lesson session", exc_info=True)
