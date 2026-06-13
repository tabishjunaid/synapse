"use client";

// Graceful degradation, made legible. Instead of "degradation rung 3" jargon, a
// calm connection-quality indicator: which modality tier is live, in plain
// language, with the reason a tap away. Degrading reads as a considered choice,
// not a failure.

import { useCallback, useState } from "react";

import { useDismissable } from "@/lib/useDismissable";
import type { SpikeState } from "@/lib/useSpikeSession";

interface RungIndicatorProps {
  state: SpikeState;
}

export function RungIndicator({ state }: RungIndicatorProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissable<HTMLDivElement>(open, close);

  const speechIn =
    state.sttDevice === "webgpu"
      ? { label: "Voice · on-device", bars: 3, why: "WebGPU Whisper runs in your browser — nothing leaves the device." }
      : state.sttDevice === "wasm"
        ? { label: "Voice · slower", bars: 2, why: "No WebGPU here, so speech runs on CPU (WASM) — accurate but slower." }
        : state.sttStatus === "error"
          ? { label: "Typed input", bars: 1, why: "Speech model unavailable; typing keeps the lesson going." }
          : { label: "Voice ready", bars: 3, why: "On-device speech recognition is ready." };

  const speechOut = state.ttsVoice
    ? state.ttsIsLocal
      ? { label: "Local voice", bars: 3, why: `Speaking with “${state.ttsVoice}” — a fully on-device voice.` }
      : { label: "Cloud voice", bars: 2, why: `“${state.ttsVoice}” is a server-backed voice (disclosed).` }
    : { label: "Captions only", bars: 1, why: "No speech voice available — the lesson shows as text." };

  const link =
    state.wsStatus === "connected"
      ? { label: "Connected", bars: 3, why: "Live link to the teaching service." }
      : state.wsStatus === "connecting"
        ? { label: "Connecting…", bars: 2, why: "Opening the link to the teaching service." }
        : { label: "Offline", bars: 1, why: "Not connected yet — sending a message will connect." };

  const overall = Math.min(speechIn.bars, link.bars);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Connection quality: ${speechIn.label}. Show details`}
        className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] px-2.5 py-1 text-xs text-[var(--ink-soft)] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      >
        <Bars n={overall} />
        <span className="hidden sm:inline">{speechIn.label}</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Connection & quality" className="glass animate-rise-in absolute end-0 top-9 z-30 w-72 rounded-2xl p-3 text-xs">
          <p className="mb-2 px-1 font-semibold text-[var(--ink)]">Connection &amp; quality</p>
          <Rung title="Speech in" {...speechIn} />
          <Rung title="Speech out" {...speechOut} />
          <Rung title="Link" {...link} />
        </div>
      )}
    </div>
  );
}

function Rung({ title, label, bars, why }: { title: string; label: string; bars: number; why: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-1 py-1.5">
      <Bars n={bars} />
      <div>
        <p className="text-[var(--ink)]">
          <span className="text-[var(--ink-faint)]">{title}:</span> {label}
        </p>
        <p className="text-[var(--ink-faint)]">{why}</p>
      </div>
    </div>
  );
}

function Bars({ n }: { n: number }) {
  return (
    <span className="flex items-end gap-0.5" style={{ height: 12 }}>
      {[5, 8, 11].map((h, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 1,
            background: i < n ? "var(--accent)" : "rgba(255,255,255,0.16)",
          }}
        />
      ))}
    </span>
  );
}
