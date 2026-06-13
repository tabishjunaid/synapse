"""QuestDB time-series telemetry sink.

The learning curve, latency, interaction signals, and eval results that power the
concept doc's d≈0.8 evaluation loop. Writes go over the InfluxDB Line Protocol
(ILP) and are **best-effort** — telemetry must never break a lesson, so every
write is wrapped and failures are logged, not raised. Reads use QuestDB's HTTP
`/exec` endpoint. Tables are global in QuestDB, so all names are prefixed.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from synapse_backend.config import get_settings

logger = logging.getLogger(__name__)

_sender = None  # lazy questdb.ingress.Sender


def _table(name: str) -> str:
    return get_settings().questdb_table_prefix + name


def _get_sender():
    global _sender
    if _sender is None:
        from questdb.ingress import Sender

        s = get_settings()
        _sender = Sender("tcp", s.questdb_host, s.questdb_ilp_port)
        _sender.establish()
    return _sender


def _row(table: str, *, symbols: dict[str, str] | None = None, columns: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.telemetry_enabled:
        return
    try:
        from questdb.ingress import ServerTimestamp

        sender = _get_sender()
        sender.row(_table(table), symbols=symbols or {}, columns=columns, at=ServerTimestamp)
        sender.flush()
    except Exception:  # telemetry is best-effort
        logger.warning("questdb write to %s failed", table, exc_info=True)


def record_turn(*, learner_id: str, lesson_id: str, first_token_ms: float,
                total_ms: float, input_tokens: int | None, output_tokens: int | None) -> None:
    _row(
        "turn_metrics",
        symbols={"learner_id": learner_id, "lesson_id": lesson_id or "none"},
        columns={
            "first_token_ms": float(first_token_ms),
            "total_ms": float(total_ms),
            "input_tokens": int(input_tokens or 0),
            "output_tokens": int(output_tokens or 0),
        },
    )


def record_interaction(*, learner_id: str, lesson_id: str, kind: str, value: float = 1.0) -> None:
    _row(
        "interaction_events",
        symbols={"learner_id": learner_id, "lesson_id": lesson_id or "none", "kind": kind},
        columns={"value": float(value)},
    )


def record_mastery(*, learner_id: str, course_id: str, skill_id: str, mastery: float) -> None:
    _row(
        "mastery_events",
        symbols={"learner_id": learner_id, "course_id": course_id, "skill_id": skill_id},
        columns={"mastery": float(mastery)},
    )


def record_eval(*, learner_id: str, lesson_id: str, phase: str, score: float) -> None:
    _row(
        "eval_events",
        symbols={"learner_id": learner_id, "lesson_id": lesson_id, "phase": phase},
        columns={"score": float(score)},
    )


async def query(sql: str) -> dict:
    """Run a read query via QuestDB's HTTP /exec. Returns the raw JSON."""
    s = get_settings()
    url = f"http://{s.questdb_host}:{s.questdb_http_port}/exec"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params={"query": sql})
        resp.raise_for_status()
        return resp.json()


def close_sender() -> None:
    global _sender
    if _sender is not None:
        try:
            _sender.close()
        except Exception:
            pass
        _sender = None
