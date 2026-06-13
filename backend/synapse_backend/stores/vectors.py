"""Vector search over CorpusChunk.

Two paths behind one `search()`:
  - Native MongoDB `$vectorSearch` (free in Community Edition 8.2+ with the
    `mongot` companion) — the production path, portable to Atlas.
  - Brute-force cosine in-app — the fallback for older Mongo / a `mongo:latest`
    image without `mongot`. Fine for a prototype corpus (hundreds of chunks).

We default to brute-force because it works on any Mongo; flip `use_native=True`
once `mongot` + a vector index are in place.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from .documents import CorpusChunk

logger = logging.getLogger(__name__)


@dataclass
class Hit:
    text: str
    source: str
    score: float


def _cosine(q: np.ndarray, m: np.ndarray) -> np.ndarray:
    qn = q / (np.linalg.norm(q) + 1e-9)
    mn = m / (np.linalg.norm(m, axis=1, keepdims=True) + 1e-9)
    return mn @ qn


async def search(scope: str, query_embedding: list[float], k: int = 5,
                 use_native: bool = False) -> list[Hit]:
    if use_native:
        try:
            return await _search_native(scope, query_embedding, k)
        except Exception:
            # A missing index / no-mongot Mongo shouldn't break retrieval — the
            # brute-force path works on any deployment.
            logger.warning("native $vectorSearch failed; falling back to cosine", exc_info=True)
    return await _search_bruteforce(scope, query_embedding, k)


async def _search_bruteforce(scope: str, query_embedding: list[float], k: int) -> list[Hit]:
    chunks = await CorpusChunk.find(CorpusChunk.scope == scope).to_list()
    if not chunks:
        return []
    mat = np.array([c.embedding for c in chunks], dtype=np.float32)
    scores = _cosine(np.array(query_embedding, dtype=np.float32), mat)
    order = np.argsort(-scores)[:k]
    return [Hit(text=chunks[i].text, source=chunks[i].source, score=float(scores[i])) for i in order]


async def _search_native(scope: str, query_embedding: list[float], k: int) -> list[Hit]:
    # Requires a `synapse_vectors` search index on the `embedding` field.
    pipeline = [
        {
            "$vectorSearch": {
                "index": "synapse_vectors",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": max(100, k * 10),
                "limit": k,
                "filter": {"scope": scope},
            }
        },
        {"$project": {"text": 1, "source": 1, "score": {"$meta": "vectorSearchScore"}}},
    ]
    hits: list[Hit] = []
    async for doc in CorpusChunk.aggregate(pipeline):
        hits.append(Hit(text=doc["text"], source=doc.get("source", ""), score=doc.get("score", 0.0)))
    return hits
