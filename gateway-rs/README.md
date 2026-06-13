# synapse-gateway (Rust, Axum + tokio)

The Phase 1 audio gateway. It replaces the Phase 0 Python relay
([`backend/.../gateway/ws.py`](../backend/synapse_backend/gateway/ws.py)) behind
the **same client protocol**, so the frontend doesn't change. The realtime
concerns the [concept doc](../docs/synapse-concept.md) (§5a) assigns to Rust live
here; the teaching brain stays in Python upstream and is never touched.

> **Status — first increment.** This crate currently does **WS termination + a
> transparent protocol proxy** to the Python brain, with the audio path
> (`vad`, `barge_in`, `media`) scaffolded as typed seams. VAD/STT/TTS are not yet
> on the hot path — they come online with the server-side tiers. The barge-in
> arbiter already tracks turn boundaries; wiring its interrupt to a live TTS
> stream + a brain-cancel signal is the next step.
>
> **Not yet compiled in this repo** — no Rust toolchain was available where it was
> authored. Run `cargo check` (below) before relying on it.

## Architecture

```
client (Next.js)  ──ws──▶  synapse-gateway (Rust)  ──ws──▶  brain (Python/FastAPI)
   transcript/audio          terminate, VAD,            fast path + between-turns
   speak_delta/...           barge-in, tier switch       planner (Claude SDK)
```

The message contract is mirrored 1:1 from the Python `protocol.py` in
[`src/protocol.rs`](src/protocol.rs). Because the protocol is symmetric JSON over
WS, the gateway can sit in front today and forward frames verbatim while it grows
the audio responsibilities — no brain changes required.

| Module | Role | State |
|---|---|---|
| `session.rs` | Per-connection WS termination + bidirectional proxy | **active** |
| `protocol.rs` | Serde mirror of the client/server contract | **active** |
| `barge_in.rs` | Turn-boundary state machine + interrupt decision | observing |
| `vad.rs` | Voice-activity detection (`Vad` trait; energy placeholder) | scaffold |
| `media.rs` | Audio framing/resample + STT/TTS tier routing traits | scaffold |
| `config.rs` | Env config (`SYNAPSE_`-prefixed, like the brain) | active |

## Build & run

```sh
# from gateway-rs/
cargo check          # type-check (do this first)
cargo run            # starts on 0.0.0.0:8770, proxying to ws://127.0.0.1:8765/ws/session
```

Config (env):

| Var | Default | What |
|---|---|---|
| `SYNAPSE_GATEWAY_BIND` | `0.0.0.0:8770` | client-facing bind |
| `SYNAPSE_BRAIN_WS` | `ws://127.0.0.1:8765/ws/session` | upstream Python brain WS |
| `SYNAPSE_FRONTEND_ORIGIN` | `http://localhost:3000` | parity with the brain |

Point the frontend at the gateway instead of the brain:

```sh
NEXT_PUBLIC_SYNAPSE_WS=ws://localhost:8770/ws/session pnpm dev
```

## Next steps (Phase 1)

1. Wire `barge_in::Decision::Interrupt` to cut the outbound stream + send a cancel upstream.
2. Implement `media::AudioFramer` (Opus/WebM decode → 16 kHz mono) for binary clients.
3. Swap `vad::EnergyVad` for a Silero ONNX `Vad` behind a `silero` feature.
4. Server-side STT/TTS tiers (`media::Stt` / `media::Tts`) for the `Server` `SttTier`.
5. Reconnection/resume across transient client drops.
