"""The teaching brain — conversation state + the fast path.

Phase 0 ships the fast path only: short, streamed, in-round-trip turns. The
actual model is a pluggable backend (``backends.py``) — a free local model by
default, Claude when billing is funded. The Opus 4.8 between-turns planner
(lesson planning, learner-model updates via structured outputs, RAG) is Phase 1
and will live alongside this module.

The brain is transport-agnostic: it yields events, the gateway serializes them.
This is the seam the Phase 1 Rust gateway plugs into.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from synapse_backend.config import Brain, get_settings

from . import prompts
from .backends import AnthropicBackend, LLMBackend, OpenAICompatBackend, Usage
from .schemas import BetweenTurnsUpdate, Lesson

# Cap history so the fast path's input stays small and latency stays bounded.
# Long-horizon memory is the Opus planner's job, not the fast path's.
MAX_HISTORY_TURNS = 12


def build_backend(brain: Brain) -> LLMBackend:
    """Build a backend for a specific brain.

    local / openai / deepseek share one OpenAI-compatible client; anthropic uses
    the official SDK. Hosted providers fail fast with a clear message if their
    key is missing, rather than surfacing an opaque 401 mid-conversation. The
    planner uses this with `effective_planner_brain` so course generation can run
    on a stronger model than the in-loop fast path.
    """
    s = get_settings()

    if brain == "anthropic":
        return AnthropicBackend(model=s.anthropic_model)

    if brain == "openai":
        _require_key(s.openai_api_key, "openai", "OPENAI_API_KEY")
        return OpenAICompatBackend(
            base_url=s.openai_base_url,
            model=s.openai_model,
            api_key=s.openai_api_key,
            # GPT-5 family: renamed reply-length field + skip hidden reasoning so
            # the small fast-path budget goes to the actual answer.
            max_tokens_field="max_completion_tokens",
            extra_body={"reasoning_effort": "minimal"},
        )

    if brain == "deepseek":
        _require_key(s.deepseek_api_key, "deepseek", "DEEPSEEK_API_KEY")
        return OpenAICompatBackend(
            base_url=s.deepseek_base_url,
            model=s.deepseek_model,
            api_key=s.deepseek_api_key,
        )

    return OpenAICompatBackend(
        base_url=s.local_base_url,
        model=s.local_model,
        api_key=s.local_api_key,
    )


def make_backend() -> LLMBackend:
    """Build the configured fast-path brain backend."""
    return build_backend(get_settings().brain)


def _require_key(value: str, brain: str, env_name: str) -> None:
    if not value:
        raise RuntimeError(
            f"SYNAPSE_BRAIN={brain} needs an API key — set {env_name} "
            f"(or SYNAPSE_{env_name}). Or use SYNAPSE_BRAIN=local for free dev."
        )


@dataclass
class TurnResult:
    full_text: str
    first_token_ms: float
    total_ms: float
    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass
class TeacherSession:
    """One learner's conversation state + the fast path.

    `system` defaults to the generic tutor prompt (the /spike loop). A lesson
    session passes a lesson-directed prompt so the teacher drives toward that
    lesson's objectives instead of free-form chat.

    In lesson mode (`lesson` set) the between-turns planner kicks in: every
    `coach_cadence` turns the gateway calls `run_between_turns()`, which re-reads
    the session on the stronger planner brain and updates `focus` — a steer the
    fast path folds into its next turns. The planner runs *between* turns (after
    the reply ships), never inside the speech round-trip.
    """

    backend: LLMBackend = field(default_factory=make_backend)
    history: list[dict] = field(default_factory=list)
    system: str = prompts.FAST_TURN_SYSTEM
    lesson: Lesson | None = None  # set in lesson mode → enables the coach
    coach_cadence: int = 3  # run the between-turns planner every N turns
    focus: str = ""  # latest between-turns steer, folded into the system prompt
    turns: int = 0  # completed turns this session

    def reset(self) -> None:
        self.history.clear()
        self.focus = ""
        self.turns = 0

    def _effective_system(self) -> str:
        if self.focus:
            return self.system + prompts.COACH_FOCUS.format(focus=self.focus)
        return self.system

    async def run_between_turns(self) -> BetweenTurnsUpdate | None:
        """Re-read the live session on the planner brain, every `coach_cadence`
        turns. Lesson mode only; the gateway calls this after shipping a reply, so
        it overlaps the learner's thinking time rather than the round-trip.
        Updates `focus` for subsequent turns; returns the update (or None)."""
        if self.lesson is None or self.coach_cadence <= 0:
            return None
        if self.turns == 0 or self.turns % self.coach_cadence != 0:
            return None
        from .between_turns import plan_between_turns

        update = await plan_between_turns(self.lesson, self.history)
        if update.focus:
            self.focus = update.focus
        return update

    async def fast_turn(self, learner_text: str) -> AsyncIterator[str | TurnResult]:
        """Run one in-round-trip turn. Yields text deltas, then a final TurnResult."""
        settings = get_settings()
        self.history.append({"role": "user", "content": learner_text})
        self._trim_history()

        started = time.perf_counter()
        first_token_at: float | None = None
        parts: list[str] = []
        usage = Usage()

        async for item in self.backend.stream(
            system=self._effective_system(),
            messages=self.history,
            max_tokens=settings.fast_max_tokens,
        ):
            if isinstance(item, Usage):
                usage = item
                continue
            if first_token_at is None:
                first_token_at = time.perf_counter()
            parts.append(item)
            yield item

        ended = time.perf_counter()
        full_text = "".join(parts)
        self.history.append({"role": "assistant", "content": full_text})
        self.turns += 1

        yield TurnResult(
            full_text=full_text,
            first_token_ms=((first_token_at or ended) - started) * 1000,
            total_ms=(ended - started) * 1000,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
        )

    def _trim_history(self) -> None:
        if len(self.history) > MAX_HISTORY_TURNS * 2:
            del self.history[: len(self.history) - MAX_HISTORY_TURNS * 2]
