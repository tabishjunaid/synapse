"use client";

// Phase 0 spike 1 — the latency spike.
// Gate (plan §9): the speech round-trip feels natural; e2e to first audio
// is measured against the < ~1.5s budget on every turn.

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { Turn } from "@/lib/useSpikeSession";
import { useSpikeSession } from "@/lib/useSpikeSession";

const BUDGET_MS = 1500;

export default function SpikePage() {
  const { state, levelRef, start, startMic, stopMic, sendTyped } = useSpikeSession();
  const [typed, setTyped] = useState("");
  const started = state.wsStatus !== "disconnected" || state.sttStatus !== "idle";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6 font-sans">
      <header>
        <h1 className="text-2xl font-semibold">Synapse — Phase 0 latency spike</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          mic → WebGPU Whisper → Haiku (streaming) → local TTS, instrumented per stage.
          Budget: first teacher audio &lt; {BUDGET_MS} ms after you stop speaking.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2 text-xs">
        <StatusChip
          label={`STT: ${state.sttStatus}${state.sttDevice ? ` (${state.sttDevice})` : ""}`}
          good={state.sttStatus === "ready" && state.sttDevice === "webgpu"}
          warn={state.sttDevice === "wasm" || state.sttStatus === "loading"}
        />
        <StatusChip label={`backend: ${state.wsStatus}`} good={state.wsStatus === "connected"} />
        <StatusChip label={`mic: ${state.micStatus}`} good={state.micStatus === "on"} warn={state.micStatus === "denied"} />
        <StatusChip
          label={`voice: ${state.ttsVoice ?? "none"}${state.ttsVoice ? (state.ttsIsLocal ? " (local)" : " (remote!)") : ""}`}
          good={state.ttsIsLocal}
          warn={!!state.ttsVoice && !state.ttsIsLocal}
        />
        {state.sttLoadMs !== null && (
          <span className="text-muted-foreground">model load: {Math.round(state.sttLoadMs)} ms</span>
        )}
      </section>

      <section className="flex items-center gap-3">
        {!started ? (
          <Button onClick={start}>Start voice session</Button>
        ) : state.micStatus === "on" ? (
          <Button variant="danger" onClick={stopMic}>Stop mic</Button>
        ) : state.sttStatus === "ready" ? (
          <Button onClick={startMic}>Start mic</Button>
        ) : state.sttStatus === "loading" ? (
          <Button disabled>Loading speech model…</Button>
        ) : state.sttStatus === "error" ? (
          // Speech failed — don't masquerade as "loading"; typed input below still works.
          <Button
            variant="secondary"
            disabled
            title="Whisper couldn't initialise in this browser; use Chrome/Edge for voice, or type below."
          >
            Speech unavailable — type below
          </Button>
        ) : (
          // Connected via typed input without ever loading STT: offer to enable mic.
          <Button onClick={start}>Enable mic</Button>
        )}
        <LevelMeter levelRef={levelRef} active={state.micStatus === "on"} />
      </section>

      {state.error && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          {state.error}
        </p>
      )}

      <section className="flex flex-col gap-4">
        {state.turns.map((turn) => (
          <TurnCard key={turn.id} turn={turn} />
        ))}
        {state.turns.length === 0 && started && (
          <p className="text-sm text-muted-foreground">Say something (or type below) to start the first turn.</p>
        )}
      </section>

      <form
        className="mt-auto flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) {
            sendTyped(typed.trim());
            setTyped("");
          }
        }}
      >
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Typed input (degradation rung 3) — connects on send"
          aria-label="Typed input"
          className="flex-1"
        />
        <Button
          type="submit"
          variant="secondary"
          // No connection gate: sending opens the WS on demand (degradation rung 3
          // must work without the speech pipeline). Only an empty box disables it.
          disabled={!typed.trim()}
        >
          {state.wsStatus === "connecting" ? "Connecting…" : "Send"}
        </Button>
      </form>
    </main>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  const t = turn.timings;
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">You: {turn.learnerText || "…"}</p>
      <p className="mt-1 text-sm">
        Teacher: {turn.teacherText || "…"}
        {!turn.done && <span className="animate-pulse" aria-hidden="true"> ▍</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Stat label="STT" value={t.sttMs} />
        <Stat label="first token (client)" value={t.clientFirstTokenMs} />
        <Stat label="first token (server)" value={t.serverFirstTokenMs} />
        <Stat label="model total" value={t.serverTotalMs} />
        <Stat label="e2e → first audio" value={t.e2eMs} budget={BUDGET_MS} />
        {t.inputTokens != null && (
          <span>
            tokens: {t.inputTokens} in / {t.outputTokens} out
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, budget }: { label: string; value?: number; budget?: number }) {
  if (value === undefined) return null;
  const over = budget !== undefined && value > budget;
  const under = budget !== undefined && value <= budget;
  // Pair colour with a glyph so pass/fail survives colour-blindness and grayscale.
  const marker = over ? " ⚠" : under ? " ✓" : "";
  return (
    <span className={over ? "font-semibold text-danger" : under ? "font-semibold text-success" : undefined}>
      {label}: {Math.round(value)} ms{marker}
    </span>
  );
}

function StatusChip({ label, good, warn }: { label: string; good?: boolean; warn?: boolean }) {
  return <Badge tone={good ? "success" : warn ? "warning" : "muted"}>{label}</Badge>;
}

function LevelMeter({ levelRef, active }: { levelRef: React.RefObject<number>; active: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      if (barRef.current) {
        const pct = Math.min(100, (levelRef.current / 0.15) * 100);
        barRef.current.style.width = `${pct}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, levelRef]);

  if (!active) return null;
  return (
    <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
      <div ref={barRef} className="h-full bg-success transition-[width] duration-75" />
    </div>
  );
}
