"""Embeddings for RAG — pluggable, default local & free via Ollama.

Mirrors the LLM-backend pattern: an OpenAI-compatible `/v1/embeddings` endpoint,
so the same code hits Ollama (`nomic-embed-text`), OpenAI, or any compatible
server. Default is local so RAG, like the brain, costs nothing in dev.
"""

from __future__ import annotations

import httpx

from synapse_backend.config import get_settings


class Embedder:
    def __init__(self, *, base_url: str, model: str, api_key: str = "local") -> None:
        self.model = model
        self._url = base_url.rstrip("/") + "/embeddings"
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0))

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        resp = await self._client.post(
            self._url, json={"model": self.model, "input": texts}, headers=self._headers
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        # Preserve request order (OpenAI returns an `index` per item).
        return [d["embedding"] for d in sorted(data, key=lambda d: d.get("index", 0))]

    async def embed_one(self, text: str) -> list[float]:
        return (await self.embed([text]))[0]

    async def aclose(self) -> None:
        await self._client.aclose()


def make_embedder() -> Embedder:
    s = get_settings()
    return Embedder(base_url=s.embed_base_url, model=s.embed_model, api_key=s.embed_api_key)
