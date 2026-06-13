"""Pluggable LLM backends for the teaching brain.

The brain is transport-agnostic by design (see the v5 plan §5a): the gateway and
the conversation logic don't care which model answers. This module is the seam.

Two backends ship:

- ``OpenAICompatBackend`` — any OpenAI-compatible ``/v1/chat/completions`` server.
  Covers local open-source models (Ollama, MLX, llama.cpp, vLLM) with zero cost
  and no API key. This is the Phase 0 default so the spike runs for free.
- ``AnthropicBackend`` — Claude via the official SDK. The product's real brain;
  flip ``SYNAPSE_BRAIN=anthropic`` once API billing is funded.

Both yield text deltas, then a final ``Usage``. The session layer
(``teacher.py``) owns history and timing; backends only stream tokens.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import httpx


@dataclass
class Usage:
    input_tokens: int | None = None
    output_tokens: int | None = None


class LLMBackend(Protocol):
    name: str

    def stream(
        self, *, system: str, messages: list[dict], max_tokens: int
    ) -> AsyncIterator[str | Usage]:
        """Yield text deltas, then exactly one final ``Usage``."""
        ...

    async def complete_json(self, *, system: str, user: str, max_tokens: int) -> dict:
        """One-shot structured generation — returns parsed JSON (not streamed).

        Used by the planner/grader. The caller validates against a Pydantic model.
        """
        ...


def extract_json(text: str) -> dict:
    """Best-effort parse of a model's JSON reply (tolerates ```json fences/prose)."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip().rstrip("`").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


class OpenAICompatBackend:
    """Streams from an OpenAI-compatible chat-completions endpoint.

    Works against Ollama (``http://localhost:11434/v1``), MLX
    (``mlx_lm.server``), llama.cpp's server, and vLLM — they all speak the same
    SSE wire format. Local servers ignore the bearer token, so a dummy key is fine.
    """

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str = "local",
        max_tokens_field: str = "max_tokens",
        extra_body: dict | None = None,
        request_timeout: float = 600.0,
    ) -> None:
        self.name = f"openai-compat:{model}"
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._model = model
        self._headers = {"Authorization": f"Bearer {api_key}"}
        # Providers disagree on the reply-length field name: Ollama/DeepSeek take
        # `max_tokens`; OpenAI's GPT-5 family renamed it to `max_completion_tokens`.
        self._max_tokens_field = max_tokens_field
        # Per-provider knobs that would break the others if sent blindly — e.g.
        # OpenAI's `reasoning_effort: "minimal"` so a fast chat turn doesn't burn
        # its small token budget on hidden reasoning.
        self._extra_body = extra_body or {}
        # Generous read timeout: structured generations are long and slow local
        # CPU models emit only a few tokens/sec, so a tight cap would abort them
        # mid-reply. Connect stays short to fail fast on an unreachable server.
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(request_timeout, connect=5.0))

    async def stream(
        self, *, system: str, messages: list[dict], max_tokens: int
    ) -> AsyncIterator[str | Usage]:
        body = {
            "model": self._model,
            self._max_tokens_field: max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
            "messages": [{"role": "system", "content": system}, *messages],
            **self._extra_body,
        }
        usage = Usage()
        async with self._client.stream(
            "POST", self._url, json=body, headers=self._headers
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:") :].strip()
                if data == "[DONE]":
                    break
                chunk = json.loads(data)
                choices = chunk.get("choices") or []
                if choices:
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content")
                    if text:
                        yield text
                # Some servers send usage only on the final (choice-less) chunk.
                if chunk.get("usage"):
                    usage = Usage(
                        input_tokens=chunk["usage"].get("prompt_tokens"),
                        output_tokens=chunk["usage"].get("completion_tokens"),
                    )
        yield usage

    async def complete_json(self, *, system: str, user: str, max_tokens: int) -> dict:
        body = {
            "model": self._model,
            self._max_tokens_field: max_tokens,
            "stream": False,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            **self._extra_body,
        }
        resp = await self._client.post(self._url, json=body, headers=self._headers)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return extract_json(content)

    async def aclose(self) -> None:
        await self._client.aclose()


class AnthropicBackend:
    """Streams from Claude via the official Anthropic SDK.

    Auth resolves the SDK's normal way: ``ANTHROPIC_API_KEY``, or an
    ``ant auth login`` OAuth profile. Needs funded API billing — see the README.
    """

    def __init__(self, *, model: str) -> None:
        # Imported lazily so the local-only path needs no Anthropic credentials
        # and never constructs a client that would search for them.
        from anthropic import AsyncAnthropic

        self.name = f"anthropic:{model}"
        self._model = model
        self._client = AsyncAnthropic()

    async def stream(
        self, *, system: str, messages: list[dict], max_tokens: int
    ) -> AsyncIterator[str | Usage]:
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
            final = await stream.get_final_message()
        yield Usage(
            input_tokens=final.usage.input_tokens,
            output_tokens=final.usage.output_tokens,
        )

    async def complete_json(self, *, system: str, user: str, max_tokens: int) -> dict:
        msg = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system + "\n\nRespond with a single valid JSON object and nothing else.",
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
        return extract_json(text)
