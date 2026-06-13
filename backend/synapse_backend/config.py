from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Brain = Literal["local", "openai", "deepseek", "anthropic"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SYNAPSE_",
        env_file=".env",
        extra="ignore",
        # Let aliased fields (the API keys) also be set by their Python name,
        # so Settings(openai_api_key=...) works alongside the OPENAI_API_KEY env.
        populate_by_name=True,
    )

    # Which brain answers the fast path.
    #   "local"     — an OpenAI-compatible server (Ollama by default). Free, no
    #                 API key. The dev default so the spike runs out of the box.
    #   "openai"    — OpenAI GPT-5 family. Cheap nano/mini tiers; US-hosted.
    #   "deepseek"  — DeepSeek. Cheapest capable hosted API; China-hosted (mind
    #                 data residency for learner text).
    #   "anthropic" — Claude via the official SDK. The product's real brain.
    # local / openai / deepseek all go through one OpenAI-compatible client; only
    # the base URL, model, key, and a couple of per-provider quirks differ.
    brain: Brain = "local"

    # Cap on the fast-path reply. Deliberately small so the teacher speaks ONE
    # short spoken turn (a couple of sentences + a question) instead of dumping a
    # written lecture — a live classroom is a back-and-forth, not an essay.
    fast_max_tokens: int = 140

    # Read timeout (seconds) for OpenAI-compatible model calls. The default is
    # generous because structured generations (course planning, the between-turns
    # planner) can be long, and slow local CPU models emit only a few tokens/sec —
    # a tight timeout would abort them mid-syllabus. Lower it for hosted brains
    # where you'd rather fail fast. Connect timeout stays short (5s).
    http_timeout: float = 600.0

    # --- local backend (Ollama / MLX / llama.cpp / vLLM) ---
    local_base_url: str = "http://localhost:11434/v1"
    local_model: str = "llama3.2:3b"
    local_api_key: str = "ollama"  # ignored by local servers

    # --- OpenAI backend ---
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-5-mini"
    # Accept the conventional OPENAI_API_KEY as well as the namespaced form.
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("SYNAPSE_OPENAI_API_KEY", "OPENAI_API_KEY"),
    )

    # --- DeepSeek backend (OpenAI-compatible) ---
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"  # V3-class; "deepseek-reasoner" is R1
    deepseek_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("SYNAPSE_DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY"),
    )

    # --- Anthropic backend ---
    # Haiku is the speed tier by construction; `effort` is NOT supported on
    # Haiku 4.5 (400s) — bound latency with streaming + max_tokens instead.
    anthropic_model: str = "claude-haiku-4-5"

    # --- planner brain (course/syllabus generation, grading) ---
    # Syllabus quality scales with the model; the planner can use a stronger
    # brain than the in-loop fast path. Empty → reuse `brain`. Set e.g.
    # SYNAPSE_PLANNER_BRAIN=deepseek to keep chat local but plan with DeepSeek.
    planner_brain: Brain | Literal[""] = ""
    # Structured-generation reply cap (course trees are large).
    planner_max_tokens: int = 4000

    # --- embeddings (RAG) — pluggable, default local & free via Ollama ---
    embed_base_url: str = "http://localhost:11434/v1"
    embed_model: str = "nomic-embed-text"
    embed_api_key: str = "ollama"
    # Use native Mongo `$vectorSearch` (needs `mongot` + a vector index) instead
    # of brute-force cosine. Self-heals to brute force on error, so it's safe to
    # flip on once the index exists. Default off → works on any Mongo.
    vector_native: bool = False

    # --- vision (writing-canvas check) — OpenAI-compatible image messages ---
    # Empty disables writing review (graceful fallback). Set to a vision model:
    # local via Ollama ("llama3.2-vision", "llava", "moondream") or hosted
    # ("gpt-5-mini"). Base URL / key fall back to the local server when unset.
    vision_model: str = ""
    vision_base_url: str = ""
    vision_api_key: str = ""

    @property
    def effective_vision_base_url(self) -> str:
        return self.vision_base_url or self.local_base_url

    @property
    def effective_vision_api_key(self) -> str:
        return self.vision_api_key or self.local_api_key

    # --- MongoDB (document/operational state) ---
    # Separate `synapse` database so we never touch other projects' data.
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db: str = "synapse"

    # --- QuestDB (time-series telemetry) ---
    # Tables are global in QuestDB, so everything is `synapse_`-prefixed.
    questdb_host: str = "localhost"
    questdb_ilp_port: int = 9009  # InfluxDB line protocol (writes)
    questdb_http_port: int = 9000  # REST /exec (reads)
    questdb_table_prefix: str = "synapse_"
    # Telemetry is best-effort; flip off to silence it entirely (e.g. in tests).
    telemetry_enabled: bool = True

    host: str = "127.0.0.1"
    port: int = 8765

    # CORS origin of the Next.js dev server.
    frontend_origin: str = "http://localhost:3000"

    @property
    def active_model(self) -> str:
        return self.model_for(self.brain)

    @property
    def effective_planner_brain(self) -> Brain:
        return self.planner_brain or self.brain

    def model_for(self, brain: Brain) -> str:
        return {
            "local": self.local_model,
            "openai": self.openai_model,
            "deepseek": self.deepseek_model,
            "anthropic": self.anthropic_model,
        }[brain]


@lru_cache
def get_settings() -> Settings:
    return Settings()
