"""The gateway <-> client message contract.

This is the narrow boundary the audio gateway owns: transcript events come in,
speak/act events go out. The Phase 1 Rust gateway replaces the transport behind
this contract without touching the brain.
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field

# ---- client -> server ------------------------------------------------------


class TranscriptEvent(BaseModel):
    """A finalized utterance from the client's STT tier."""

    type: Literal["transcript"] = "transcript"
    text: str
    # Client-side stage timings (ms), for the Phase 0 latency spike.
    # speech_end_ts is performance.now() at end-of-speech on the client clock;
    # it is echoed back so the client can compute end-to-end numbers itself.
    speech_end_ts: float | None = None
    stt_ms: float | None = Field(default=None, description="STT decode time on the client")


class ResetEvent(BaseModel):
    """Clear conversation history (new lesson segment)."""

    type: Literal["reset"] = "reset"


ClientEvent = Union[TranscriptEvent, ResetEvent]


# ---- server -> client ------------------------------------------------------


class TurnStart(BaseModel):
    type: Literal["turn_start"] = "turn_start"
    turn_id: int
    speech_end_ts: float | None = None


class SpeakDelta(BaseModel):
    """A streamed chunk of teacher speech text."""

    type: Literal["speak_delta"] = "speak_delta"
    turn_id: int
    text: str


class TurnLatency(BaseModel):
    """Server-side stage timings for one turn (all ms)."""

    first_token_ms: float
    total_ms: float
    input_tokens: int | None = None
    output_tokens: int | None = None


class TurnEnd(BaseModel):
    type: Literal["turn_end"] = "turn_end"
    turn_id: int
    full_text: str
    latency: TurnLatency
    speech_end_ts: float | None = None


class LearnerSkill(BaseModel):
    skill_id: str
    mastery: float


class LearnerUpdate(BaseModel):
    """A live learner-model update from the between-turns planner.

    Emitted between turns (not every turn) so the UI — skill constellation,
    captions — reflects in-session mastery without waiting for lesson completion.
    """

    type: Literal["learner_update"] = "learner_update"
    turn_id: int
    skills: list[LearnerSkill] = []
    focus: str = ""
    ready_to_check: bool = False


class ServerError(BaseModel):
    type: Literal["error"] = "error"
    message: str


ServerEvent = Union[TurnStart, SpeakDelta, TurnEnd, LearnerUpdate, ServerError]
