"""Protocol round-trip test for the gateway, with the brain faked out.

Exercises the full WS contract (transcript in -> turn_start / speak_delta* /
turn_end out) without calling the Claude API.
"""

import json

from fastapi.testclient import TestClient

from synapse_backend.brain.teacher import TurnResult
from synapse_backend.gateway import ws as ws_module
from synapse_backend.main import app


class FakeSession:
    def __init__(self) -> None:
        self.reset_called = False

    def reset(self) -> None:
        self.reset_called = True

    async def fast_turn(self, learner_text: str):
        yield "Hello "
        yield "there!"
        yield TurnResult(
            full_text="Hello there!",
            first_token_ms=100.0,
            total_ms=250.0,
            input_tokens=42,
            output_tokens=5,
        )


def test_transcript_round_trip(monkeypatch):
    monkeypatch.setattr(ws_module, "TeacherSession", FakeSession)
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as sock:
        sock.send_text(
            json.dumps({"type": "transcript", "text": "hi", "speech_end_ts": 123.0, "stt_ms": 80.0})
        )

        start = json.loads(sock.receive_text())
        assert start == {"type": "turn_start", "turn_id": 1, "speech_end_ts": 123.0}

        d1 = json.loads(sock.receive_text())
        d2 = json.loads(sock.receive_text())
        assert (d1["type"], d1["text"]) == ("speak_delta", "Hello ")
        assert (d2["type"], d2["text"]) == ("speak_delta", "there!")

        end = json.loads(sock.receive_text())
        assert end["type"] == "turn_end"
        assert end["turn_id"] == 1
        assert end["full_text"] == "Hello there!"
        assert end["latency"]["first_token_ms"] == 100.0
        assert end["speech_end_ts"] == 123.0


def test_bad_event_yields_error(monkeypatch):
    monkeypatch.setattr(ws_module, "TeacherSession", FakeSession)
    client = TestClient(app)

    with client.websocket_connect("/ws/session") as sock:
        sock.send_text(json.dumps({"type": "transcript"}))  # missing text
        err = json.loads(sock.receive_text())
        assert err["type"] == "error"


def test_healthz():
    client = TestClient(app)
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
