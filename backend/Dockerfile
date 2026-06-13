# Synapse teaching service — FastAPI, run with uv.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Faster, hermetic installs; copy (not hardlink) since the cache is on another layer.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install dependencies first (cached unless the lockfile changes).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Then the application code, and install the project itself.
COPY . .
RUN uv sync --frozen --no-dev

# Bind on all interfaces inside the container; brain + base URL come from compose.
ENV SYNAPSE_HOST=0.0.0.0 \
    SYNAPSE_PORT=8765
EXPOSE 8765

CMD ["uv", "run", "--no-dev", "uvicorn", "synapse_backend.main:app", \
     "--host", "0.0.0.0", "--port", "8765"]
