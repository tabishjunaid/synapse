"""MongoDB connection + Beanie init. No SQL, no ORM — a document store.

Beanie 2.x uses pymongo's native async client (`AsyncMongoClient`), not Motor.
"""

from __future__ import annotations

from beanie import init_beanie
from pymongo import AsyncMongoClient

from synapse_backend.config import get_settings

from .documents import ALL_DOCUMENTS

_client: AsyncMongoClient | None = None


async def init_db(client: AsyncMongoClient | None = None, db_name: str | None = None) -> None:
    """Connect and register documents. Pass a client/db_name in tests."""
    global _client
    settings = get_settings()
    _client = client or AsyncMongoClient(settings.mongo_url)
    await init_beanie(
        database=_client[db_name or settings.mongo_db],
        document_models=ALL_DOCUMENTS,
    )


async def close_db() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
