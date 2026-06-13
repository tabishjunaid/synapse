"""Corpus ingestion → grounding round-trip, against a test Mongo.

The embedder is faked so no embedding server is needed; we only assert that
ingested chunks land in the corpus and come back out of `rag.ground` for the
same scope (ranking quality is covered by test_rag's cosine test).
"""

from synapse_backend import courses
from synapse_backend.brain import rag
from synapse_backend.brain.schemas import GoalSpec


class FakeEmbedder:
    async def embed(self, texts):
        # Deterministic, length-derived vectors — enough for a non-empty corpus.
        return [[float(len(t)), 1.0, 0.0] for t in texts]

    async def embed_one(self, text):
        return [float(len(text)), 1.0, 0.0]

    async def aclose(self):
        pass


async def test_ingest_then_ground_round_trip(db, monkeypatch):
    monkeypatch.setattr(rag, "make_embedder", lambda: FakeEmbedder())

    goal = await courses.create_goal(
        GoalSpec(subject="algebra", target_outcome="solve quadratics")
    )
    result = await courses.ingest_corpus(
        "The quadratic formula solves ax^2 + bx + c = 0.",
        source="textbook",
        goal_id=str(goal.id),
    )
    assert result == {"scope": f"course:{goal.id}", "chunks_added": 1}

    grounded = await rag.ground(result["scope"], "quadratic formula")
    assert "quadratic formula" in grounded.lower()
    assert "textbook" in grounded  # source is surfaced in the grounding block


async def test_ingest_explicit_pack_scope(db, monkeypatch):
    monkeypatch.setattr(rag, "make_embedder", lambda: FakeEmbedder())

    result = await courses.ingest_corpus("Arabic letters connect.", scope="pack:arabic")
    assert result["scope"] == "pack:arabic"
    assert result["chunks_added"] == 1


async def test_ingest_unknown_goal_returns_none(db, monkeypatch):
    monkeypatch.setattr(rag, "make_embedder", lambda: FakeEmbedder())
    # Well-formed but nonexistent ObjectId.
    result = await courses.ingest_corpus("x", goal_id="0" * 24)
    assert result is None


async def test_corpus_stats_and_delete(db, monkeypatch):
    monkeypatch.setattr(rag, "make_embedder", lambda: FakeEmbedder())

    await courses.ingest_corpus("First fact. Second fact.", scope="pack:demo")
    stats = await courses.corpus_stats("pack:demo")
    assert stats == {"scope": "pack:demo", "chunks": 1}

    removed = await courses.delete_corpus("pack:demo")
    assert removed == {"scope": "pack:demo", "deleted": 1}
    assert (await courses.corpus_stats("pack:demo"))["chunks"] == 0


async def test_resolve_scope_prefers_explicit(db):
    # Explicit scope wins and needs no goal lookup.
    assert await courses.resolve_corpus_scope(None, "pack:x") == "pack:x"
    assert await courses.resolve_corpus_scope(None, None) is None
    assert await courses.resolve_corpus_scope("0" * 24, None) is None
