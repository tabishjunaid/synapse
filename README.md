# Synapse

A virtual professor that **sees, hears, and reads** the learner — a Claude brain behind a
swappable per-subject knowledge pack. Full concept and architecture:
[docs/synapse-concept.md](docs/synapse-concept.md) (v5).

## Layout

| Path | What |
|---|---|
| `backend/` | Teaching service — FastAPI, Python. `gateway/` (REST `api.py` + WebSocket `ws.py`), `brain/` (planner, grader, teacher, the between-turns planner, RAG, embeddings, pluggable LLM backends), `stores/` (MongoDB documents + QuestDB telemetry + vector search), `courses.py` (formulation + gating service). |
| `gateway-rs/` | Phase 1 audio gateway — Rust (Axum + tokio). Terminates the client WS and proxies the same protocol to the Python brain; owns VAD/barge-in/tier-switching (scaffolded). See its README. |
| `frontend/` | Next.js 16 (App Router, TypeScript, Tailwind). `/onboarding` → `/course` → `/lesson/[id]`; `/spike` is the Phase 0 latency spike. Design tokens + `components/ui/`. |
| `docs/` | Concept document. |

## The teacher — goal → syllabus → lessons → mastery

The course layer turns a goal into a taught, masterable course:

1. **`/onboarding`** — you state a goal (any subject); the **planner** drafts a structured
   syllabus (modules → lessons → objectives/skills, each with a ~mastery bar and a pedagogy
   shape), grounded against a corpus when one exists (RAG).
2. **`/course`** — the syllabus dashboard: modules, lessons, progress, pacing, mastery gating
   (lessons unlock as you master prerequisites).
3. **`/lesson/[id]`** — a lesson session over the same voice/chat loop, but **directed** by the
   lesson's objectives ("I do → we do → you do"). Text-first; voice opt-in.
4. **Check my understanding** — the **grader** scores each skill from the transcript, updates
   mastery, gates the next lesson, and writes a recap.

**Data:** MongoDB holds the course tree + learner state + sessions (Beanie); QuestDB holds
time-series telemetry (latency, mastery-over-time, eval). Both reuse existing instances via
`SYNAPSE_MONGO_URL` / `SYNAPSE_QUESTDB_HOST`, or the bundled compose services. Embeddings + the
brain run locally and free by default, so the whole flow costs nothing in dev. Vector search
uses native Mongo `$vectorSearch` (8.2+ with `mongot`, enable with `SYNAPSE_VECTOR_NATIVE=1`;
self-heals to brute force if the index is missing) or the brute-force fallback. Feed a corpus
with `POST /api/corpus` (`{goal_id|scope, text, source}`) before generating a course so the
syllabus and lessons ground on it; `GET`/`DELETE /api/corpus?scope=…` inspect and clear it.

Run it: backend (below) + `pnpm dev`, then open `/onboarding`. The first syllabus + each
grader pass take a few seconds on the local model; set `SYNAPSE_PLANNER_BRAIN=deepseek` (or
`anthropic`) for sharper course/grading quality while chat stays local.

## The classroom — immersive lecture-hall view

`/classroom` is the immersive surface (presence orb, self-drawing whiteboard, skill
constellation, captions, writing canvas, pack switcher). Its backend (`gateway/classroom.py`)
serves the data each piece needs, shapes matching the frontend interfaces exactly:

| Endpoint | Powers | Source |
|---|---|---|
| `GET /api/knowledge-packs` | Pack switcher (personas) | `packs.py` (design tokens + capability tiers) |
| `GET /api/lesson/{id}/constellation` | Skill star-map | the **learner model** (mastery, SRS, gating) — no LLM |
| `GET /api/lesson/{id}/board` | Whiteboard (title, MathML, note, diagram) | generated per lesson, **cached** in Mongo |
| `GET /api/lesson/{id}/glossary` | Tap-to-deepen terms | generated per lesson, **cached** |
| `POST /api/writing-check` | Writing-canvas review | vision model (see below) |

Board/glossary are generated once per lesson and cached (`classroom_artifacts`); the
constellation is live learner data. **Writing review** needs a vision model — set
`SYNAPSE_VISION_MODEL` (a local `moondream`/`llama3.2-vision`/`llava` via Ollama, or a hosted
vision model); without it the endpoint degrades gracefully. The classroom's voice/caption loop
reuses the existing `/ws/session`.

## Phase 0 — the latency spike

The spike proves the speech round-trip: **mic → on-device WebGPU Whisper → Haiku
(streaming) → local browser TTS**, with per-stage latency instrumentation. Gate: first
teacher audio < ~1.5 s after end of speech.

### Run the backend

The brain is a pluggable backend (`brain/backends.py`), chosen by `SYNAPSE_BRAIN`
(`local` | `openai` | `deepseek` | `anthropic`). `local`, `openai`, and `deepseek` all go
through one OpenAI-compatible client; only the URL, model, key, and a couple of
provider quirks differ. `GET /healthz` reports the active brain and model.

| `SYNAPSE_BRAIN` | Default model | Key | Cost / notes |
|---|---|---|---|
| `local` (default) | `llama3.2:3b` (Ollama) | none | free; dev default |
| `openai` | `gpt-5-mini` | `OPENAI_API_KEY` | cheap, US-hosted |
| `deepseek` | `deepseek-chat` | `DEEPSEEK_API_KEY` | cheapest hosted; China-hosted (mind learner-data residency) |
| `anthropic` | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` / `ant` profile | premium; the product's real brain |

Each provider's model and base URL are overridable: `SYNAPSE_OPENAI_MODEL`,
`SYNAPSE_DEEPSEEK_MODEL`, `SYNAPSE_LOCAL_BASE_URL`, etc. Hosted brains fail fast at
startup with a clear message if their key is missing.

```sh
# free local dev (default)
uv run uvicorn synapse_backend.main:app --port 8765

# DeepSeek
SYNAPSE_BRAIN=deepseek DEEPSEEK_API_KEY=sk-... uv run uvicorn synapse_backend.main:app --port 8765

# OpenAI
SYNAPSE_BRAIN=openai OPENAI_API_KEY=sk-... uv run uvicorn synapse_backend.main:app --port 8765
```

#### `local` (default) — free, no API key

A local open-source model via any OpenAI-compatible server. Defaults to **Ollama +
`llama3.2:3b`**. This is what Phase 0 uses so the spike runs at zero cost.

```sh
brew install ollama
ollama serve &              # or: brew services start ollama
ollama pull llama3.2:3b     # ~2 GB; first model call loads weights (cold start)

cd backend
uv run uvicorn synapse_backend.main:app --port 8765
```

The first turn pays a one-time cold-start (~2 s) while the model loads into memory;
warm turns answer in well under a second. Set `OLLAMA_KEEP_ALIVE=-1` to keep the model
resident. Point at a different model/server with `SYNAPSE_LOCAL_MODEL` and
`SYNAPSE_LOCAL_BASE_URL` (MLX, llama.cpp, and vLLM all speak the same protocol). With
48 GB of RAM you can size up — e.g. `ollama pull qwen2.5:7b` then
`SYNAPSE_LOCAL_MODEL=qwen2.5:7b` — for noticeably better tutoring.

#### `anthropic` — Claude, the product's real brain

Needs funded API billing. Set `SYNAPSE_BRAIN=anthropic`, then authenticate either way:

1. **No static key (subscription):** `ant auth login` once (Anthropic CLI; `brew install
   anthropics/tap/ant`). The OAuth profile under `~/.config/anthropic/` is picked up
   automatically — but only if `ANTHROPIC_API_KEY` is **unset** (even an empty value
   overrides it).
2. **API key:** `export ANTHROPIC_API_KEY=sk-ant-...`

Tests (no model or key needed — the brain is faked, and dispatch is asserted offline):

```sh
uv run pytest
```

### Run the frontend

```sh
cd frontend
pnpm install
pnpm dev   # http://localhost:3000/spike
```

Use Chrome/Edge for WebGPU Whisper (tier 1 STT). Without WebGPU the worker falls back to
WASM (slow, flagged in the UI); without a mic, the typed-input box exercises the same
round-trip (degradation rung 3). The backend WS URL defaults to
`ws://localhost:8765/ws/session`; override with `NEXT_PUBLIC_SYNAPSE_WS`.

### What to read on each turn

- **STT** — Whisper decode time in the worker
- **first token (client)** — WS send → first streamed delta (network + server)
- **first token (server)** — API request → first Haiku token
- **e2e → first audio** — end of speech → first TTS audio; green under 1500 ms
