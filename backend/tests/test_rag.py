"""Pure-logic RAG tests (no Mongo / no embedding server)."""

import numpy as np

from synapse_backend.brain.rag import _chunk
from synapse_backend.stores.vectors import _cosine


def test_cosine_ranks_nearest_first():
    q = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    mat = np.array([[0.0, 1.0, 0.0], [0.9, 0.1, 0.0], [1.0, 0.0, 0.0]], dtype=np.float32)
    scores = _cosine(q, mat)
    assert int(np.argmax(scores)) == 2  # identical vector wins
    assert scores[1] > scores[0]  # mostly-aligned beats orthogonal


def test_chunk_windows_long_text_with_overlap():
    text = "x" * 2000
    chunks = _chunk(text)
    assert len(chunks) > 1
    assert all(len(c) <= 900 for c in chunks)


def test_chunk_short_text_single():
    assert _chunk("hello world") == ["hello world"]
    assert _chunk("   ") == []


def test_chunk_is_boundary_aware():
    # Sentences pack into windows without splitting mid-sentence; every chunk
    # stays within the char budget.
    sentences = [f"This is sentence number {i} about a topic." for i in range(60)]
    chunks = _chunk(" ".join(sentences))
    assert len(chunks) > 1
    assert all(len(c) <= 900 for c in chunks)
    # No chunk ends mid-word: boundary-aware packing keeps whole sentences.
    assert all(c.strip().endswith(".") for c in chunks)


def test_chunk_hard_windows_unbreakable_run():
    # A long run with no boundaries must still be split under the budget.
    chunks = _chunk("x" * 2000)
    assert len(chunks) > 1
    assert all(len(c) <= 900 for c in chunks)
