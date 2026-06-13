# Synapse frontend — Next.js 16 (standalone output), built and served with pnpm/node.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

# A build-scoped pnpm-workspace.yaml, written into the image only (the committed file is
# never modified), to get past three pnpm 11.6 defaults that block a clean non-interactive
# image build — while keeping the deps exactly as the lockfile pins them:
#   minimumReleaseAge: 0   — disable the 24h supply-chain age gate; deps are already pinned.
#   strictDepBuilds: false — don't hard-fail on the native build scripts we deliberately
#                            skip. The browser does Whisper via WASM/WebGPU, so the node
#                            onnx binary isn't needed; tailwind's oxide IS built (not in the
#                            ignore list), so there's no wasm fallback / nested install.
#   ignoredBuiltDependencies — mirrors the committed frontend/pnpm-workspace.yaml.
FROM base AS workspace
RUN printf 'ignoredBuiltDependencies:\n  - sharp\n  - unrs-resolver\n  - onnxruntime-node\n  - protobufjs\nminimumReleaseAge: 0\nstrictDepBuilds: false\n' > /pnpm-workspace.yaml

# --- dependencies (cached on the lockfile) ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY --from=workspace /pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# --- build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=workspace /pnpm-workspace.yaml ./pnpm-workspace.yaml
# NEXT_PUBLIC_* is inlined at build time — the browser WS endpoint must be set here.
ARG NEXT_PUBLIC_SYNAPSE_WS=ws://localhost:8765/ws/session
ENV NEXT_PUBLIC_SYNAPSE_WS=$NEXT_PUBLIC_SYNAPSE_WS
# Call next directly (not `pnpm build`) to skip pnpm's pre-run deps-status check, which
# would otherwise spawn a nested install.
RUN ./node_modules/.bin/next build

# --- runtime (slim, only the standalone server) ---
FROM base AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
