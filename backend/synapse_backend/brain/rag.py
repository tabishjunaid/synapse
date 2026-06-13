"""RAG — ingestion, retrieval, and grounding.

Kept entirely inside the Mongo stack: chunks + embeddings live in CorpusChunk,
retrieval is `stores.vectors.search` (brute-force cosine now, native
`$vectorSearch` once mongot is in place). Grounding is *optional* — with a corpus
the planner/teacher cite vetted sources; without one they fall back to model
knowledge (flagged), so an arbitrary-subject course is never blocked.
"""

from __future__ import annotations

import logging
import re

from synapse_backend.config import get_settings
from synapse_backend.stores.documents import CorpusChunk
from synapse_backend.stores.vectors import Hit, search

from .embeddings import make_embedder

logger = logging.getLogger(__name__)

# Boundary-aware chunking: pack whole sentences/paragraphs into ~CHUNK_CHARS
# windows so a chunk rarely splits mid-thought (better retrieval than a blind
# char window), hard-windowing any single over-long unit. Char-budgeted rather
# than token-budgeted to stay tokenizer-free; ~CHUNK_CHARS ≈ 220 tokens.
CHUNK_CHARS = 900
CHUNK_OVERLAP = 150
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n{2,}")


def _hard_window(unit: str) -> list[str]:
    """Fixed char windows for a unit with no usable boundary (e.g. one long run)."""
    out, start = [], 0
    step = CHUNK_CHARS - CHUNK_OVERLAP
    while start < len(unit):
        out.append(unit[start : start + CHUNK_CHARS])
        start += step
    return out


def _chunk(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= CHUNK_CHARS:
        return [text]

    units = [u.strip() for u in _SENT_SPLIT.split(text) if u.strip()]
    chunks: list[str] = []
    cur = ""
    for u in units:
        if len(u) > CHUNK_CHARS:  # an unbreakable run — hard-window it
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.extend(_hard_window(u))
        elif cur and len(cur) + 1 + len(u) > CHUNK_CHARS:  # window full — flush
            chunks.append(cur)
            tail = cur[-CHUNK_OVERLAP:]  # carry a little context into the next
            joined = f"{tail} {u}".strip()
            cur = joined if len(joined) <= CHUNK_CHARS else u
        else:
            cur = f"{cur} {u}".strip() if cur else u
    if cur:
        chunks.append(cur)
    return chunks


async def ingest(scope: str, text: str, source: str = "") -> int:
    """Chunk → embed → upsert one source into the corpus. Returns chunks added."""
    chunks = _chunk(text)
    if not chunks:
        return 0
    embedder = make_embedder()
    try:
        vectors = await embedder.embed(chunks)
    finally:
        await embedder.aclose()
    docs = [
        CorpusChunk(scope=scope, text=c, embedding=v, source=source)
        for c, v in zip(chunks, vectors)
    ]
    await CorpusChunk.insert_many(docs)
    return len(docs)


async def retrieve(scope: str, query: str, k: int = 5) -> list[Hit]:
    """Top-k corpus hits for a query within a scope. Empty if no corpus.

    Uses native `$vectorSearch` when `SYNAPSE_VECTOR_NATIVE` is on (requires the
    `mongot` index); otherwise brute-force cosine. The native path self-heals to
    brute force on error, so flipping the flag can't break retrieval.
    """
    embedder = make_embedder()
    try:
        qv = await embedder.embed_one(query)
    finally:
        await embedder.aclose()
    return await search(scope, qv, k=k, use_native=get_settings().vector_native)


async def ground(scope: str, query: str, k: int = 5) -> str:
    """Retrieved context as a prompt-ready block, or '' if nothing is available."""
    try:
        hits = await retrieve(scope, query, k=k)
    except Exception:
        logger.warning("RAG retrieval failed; proceeding ungrounded", exc_info=True)
        return ""
    if not hits:
        return ""
    return "\n\n".join(f"[{h.source or 'source'}] {h.text}" for h in hits)
