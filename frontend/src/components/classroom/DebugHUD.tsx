"use client";

// The oscilloscope, demoted. All the Phase 0 instrumentation — system chips and
// per-turn latency cards — lives here behind a toggle (⌘.), so the learner sees
// a clean classroom while engineers keep the full read-out. The latency budget
// is still coloured green/red with a ✓/⚠ glyph for colour-blind safety.

import type { SpikeState, Turn } from "@/lib/useSpikeSession";

const BUDGET_MS = 1500;

interface DebugHUDProps {
  state: SpikeState;
  open: boolean;
  onClose: () => void;
}

export function DebugHUD({ state, open, onClose }: DebugHUDProps) {
  if (!open) return null;
  return (
    <div className="animate-rise-in fixed bottom-4 right-4 top-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#0b0e16]/95 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-2.5">
        <span className="font-mono text-xs text-[var(--ink-soft)]">latency · debug HUD</span>
        <button onClick={onClose} className="text-[var(--ink-faint)] transition hover:text-[var(--ink)]" aria-label="Close debug HUD">
          ✕ <span className="ml-1 font-mono text-[10px]">⌘.</span>
        </button>
      </div>

      <div className="scroll-soft flex-1 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Chip label={`STT: ${state.sttStatus}${state.sttDevice ? ` (${state.sttDevice})` : ""}`} good={state.sttStatus === "ready" && state.sttDevice === "webgpu"} warn={state.sttDevice === "wasm" || state.sttStatus === "loading"} bad={state.sttStatus === "error"} />
          <Chip label={`backend: ${state.wsStatus}`} good={state.wsStatus === "connected"} warn={state.wsStatus === "connecting"} />
          <Chip label={`mic: ${state.micStatus}`} good={state.micStatus === "on"} bad={state.micStatus === "denied"} />
          <Chip label={`voice: ${state.ttsVoice ? (state.ttsIsLocal ? "local" : "remote!") : "none"}`} good={state.ttsIsLocal} warn={!!state.ttsVoice && !state.ttsIsLocal} />
          {state.sttLoadMs !== null && (
            <span className="text-[var(--ink-faint)]">model load: {Math.round(state.sttLoadMs)} ms</span>
          )}
        </div>

        {state.error && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">{state.error}</p>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {state.turns.length === 0 && (
            <p className="text-xs text-[var(--ink-faint)]">No turns yet. Speak or type to record one.</p>
          )}
          {[...state.turns].reverse().map((t) => (
            <TurnCard key={t.id} turn={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  const t = turn.timings;
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-2.5">
      <p className="truncate text-[11px] text-[var(--ink-faint)]">You: {turn.learnerText || "…"}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-soft)]">Teacher: {turn.teacherText || "…"}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--ink-faint)]">
        <Stat label="STT" value={t.sttMs} />
        <Stat label="ttft(c)" value={t.clientFirstTokenMs} />
        <Stat label="ttft(s)" value={t.serverFirstTokenMs} />
        <Stat label="total" value={t.serverTotalMs} />
        <Stat label="e2e" value={t.e2eMs} budget={BUDGET_MS} />
        {t.inputTokens != null && <span>tok {t.inputTokens}/{t.outputTokens}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, budget }: { label: string; value?: number; budget?: number }) {
  if (value === undefined) return null;
  const over = budget !== undefined && value > budget;
  const under = budget !== undefined && value <= budget;
  const marker = over ? " ⚠" : under ? " ✓" : "";
  return (
    <span className={over ? "font-semibold text-red-400" : under ? "font-semibold text-green-400" : undefined}>
      {label} {Math.round(value)}{marker}
    </span>
  );
}

function Chip({ label, good, warn, bad }: { label: string; good?: boolean; warn?: boolean; bad?: boolean }) {
  const color = bad
    ? "border-red-500/40 text-red-300"
    : good
      ? "border-green-500/40 text-green-300"
      : warn
        ? "border-amber-500/40 text-amber-300"
        : "border-[rgba(255,255,255,0.12)] text-[var(--ink-faint)]";
  return <span className={`rounded-full border px-2 py-0.5 ${color}`}>{label}</span>;
}
