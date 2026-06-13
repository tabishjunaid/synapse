import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from synapse_backend.config import get_settings
from synapse_backend.gateway import api, classroom, ws
from synapse_backend.stores import metrics
from synapse_backend.stores.mongo import close_db, init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mongo is required for the course features; the speech /spike loop still
    # works without it, so a connection failure degrades rather than crashes.
    try:
        await init_db()
        logger.info("MongoDB connected (%s)", get_settings().mongo_db)
    except Exception:
        logger.warning("MongoDB unavailable — course features disabled", exc_info=True)
    yield
    metrics.close_sender()
    await close_db()


app = FastAPI(title="Synapse teaching service", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    # Dev convenience: also accept any localhost / 127.0.0.1 port so the browser
    # isn't CORS-blocked whether the UI is on :3000 (dev), :3001 (bundled
    # frontend), or an ad-hoc dev-server port. Tighten for production.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws.router)
app.include_router(api.router)
app.include_router(classroom.router)


@app.get("/healthz")
async def healthz() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "brain": s.brain,
        "model": s.active_model,
        "planner_brain": s.effective_planner_brain,
    }
