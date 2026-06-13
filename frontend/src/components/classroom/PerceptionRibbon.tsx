"use client";

// Honest, always-visible account of what the professor currently perceives —
// and a tap-to-reveal of exactly what leaves the device. The concept doc makes
// on-device camera an absolute rule; this turns that promise into UI, not fine
// print. Sensing is a trust surface, not a dashboard.

import { useCallback, useState } from "react";

import { useDismissable } from "@/lib/useDismissable";

interface PerceptionRibbonProps {
  listening: boolean;
  cameraOn: boolean;
  reading: boolean;
  /** 0..1 engagement score (derived on-device; only the score would ever leave). */
  engagement: number;
}

export function PerceptionRibbon({ listening, cameraOn, reading, engagement }: PerceptionRibbonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissable<HTMLDivElement>(open, close);
  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      <Sense active={listening} label="Hearing" icon={<EarIcon />} live={listening} />
      <Sense
        active={cameraOn}
        label={cameraOn ? `Seeing · ${Math.round(engagement * 100)}%` : "Camera off"}
        icon={<EyeIcon />}
        live={cameraOn}
      />
      <Sense active={reading} label="Reading" icon={<PenIcon />} live={reading} />

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="What does the professor sense, and what leaves my device?"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="perception-disclosure"
        className="ml-1 grid h-6 w-6 place-items-center rounded-full border border-[rgba(255,255,255,0.12)] text-[11px] text-[var(--ink-soft)] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      >
        <span aria-hidden="true">?</span>
      </button>

      {open && (
        <div id="perception-disclosure" role="dialog" aria-label="What stays, what leaves" className="glass animate-rise-in absolute right-0 top-9 z-30 w-72 rounded-2xl p-4 text-left text-xs leading-relaxed text-[var(--ink-soft)]">
          <p className="mb-2 font-semibold text-[var(--ink)]">What stays, what leaves</p>
          <Row dot="#34d2a6" k="Camera">processed on-device; only an engagement score ever leaves — never video.</Row>
          <Row dot="var(--accent)" k="Microphone">on-device when your hardware allows; otherwise audio goes to our STT only.</Row>
          <Row dot="var(--accent)" k="Writing">your strokes are rendered to an image the professor reads.</Row>
          <p className="mt-2 text-[var(--ink-faint)]">You can turn any sense off at any time.</p>
        </div>
      )}
    </div>
  );
}

function Sense({
  active,
  label,
  icon,
  live,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  live: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-[rgba(var(--glow),0.35)] text-[var(--ink)]"
          : "border-[rgba(255,255,255,0.08)] text-[var(--ink-faint)]"
      }`}
    >
      <span className={active ? "accent-text" : "opacity-50"}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {live && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
        />
      )}
    </div>
  );
}

function Row({ dot, k, children }: { dot: string; k: string; children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex gap-2">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span>
        <span className="font-medium text-[var(--ink)]">{k}:</span> {children}
      </span>
    </p>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 8a6 6 0 0 1 12 0c0 3-2 4-3 5s-1 2-1 3a3 3 0 0 1-6 0" />
      <path d="M9 9a3 3 0 0 1 6 0" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19l7-7-4-4-7 7v4h4Z" />
      <path d="M16 6l2-2 4 4-2 2" />
    </svg>
  );
}
