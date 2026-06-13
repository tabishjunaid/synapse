"""Test fixtures.

DB-touching tests run against a real but disposable `synapse_test` Mongo (Beanie
2.x uses pymongo's async client, which mongomock doesn't patch). Tests skip
cleanly if Mongo is unreachable. Telemetry is off so QuestDB isn't required.
"""

import os

os.environ.setdefault("SYNAPSE_MONGO_DB", "synapse_test")
os.environ.setdefault("SYNAPSE_TELEMETRY_ENABLED", "false")

import pytest_asyncio

from synapse_backend.config import get_settings

get_settings.cache_clear()


@pytest_asyncio.fixture
async def db():
    import pytest

    from synapse_backend.stores.documents import ALL_DOCUMENTS
    from synapse_backend.stores.mongo import close_db, init_db

    try:
        await init_db()
    except Exception as exc:  # Mongo not running
        pytest.skip(f"MongoDB unavailable: {exc}")
    for doc in ALL_DOCUMENTS:
        await doc.delete_all()
    yield
    for doc in ALL_DOCUMENTS:
        await doc.delete_all()
    await close_db()
