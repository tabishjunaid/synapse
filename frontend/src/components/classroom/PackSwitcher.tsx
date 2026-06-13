"use client";

// Switching knowledge packs visibly changes the room — accent, display font,
// density, direction (LTR/RTL), the professor's name and voice. "Each teacher
// feels different" is data (persona tokens), not a CSS fork. The Arabic pack
// flips the whole layout via logical properties for free.

import { useCallback, useState } from "react";

import { useDismissable } from "@/lib/useDismissable";
import type { Persona } from "@/lib/personas";

interface PackSwitcherProps {
  personas: Persona[];
  current: Persona;
  onChange: (p: Persona) => void;
}

export function PackSwitcher({ personas, current, onChange }: PackSwitcherProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissable<HTMLDivElement>(open, close);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Knowledge pack: ${current.name}, ${current.subject}. Change pack`}
        className="glass flex items-center gap-2.5 rounded-full py-1.5 pe-3 ps-1.5 transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      >
        <Avatar p={current} />
        <span className="text-start leading-tight">
          <span className="block text-sm font-semibold text-[var(--ink)]">{current.name}</span>
          <span className="block text-[11px] text-[var(--ink-faint)]">{current.subject}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ms-1 text-[var(--ink-faint)]">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="menu" aria-label="Knowledge packs" className="glass animate-rise-in absolute start-0 top-[calc(100%+8px)] z-40 w-72 rounded-2xl p-1.5">
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Knowledge packs</p>
          {personas.map((p) => {
            const selected = p.id === current.id;
            return (
              <button
                key={p.id}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                dir={p.dir}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)] ${
                  selected ? "bg-white/5" : "hover:bg-white/5"
                }`}
              >
                <Avatar p={p} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--ink)]" style={{ fontFamily: p.fontDisplay }}>
                    {p.name}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--ink-faint)]">
                    {p.subject} · voice {p.voiceHint}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Tier label={p.sttTier === "server" ? "STT·srv" : "STT·dev"} />
                  <Tier label={p.ttsTier === "cloud" ? "TTS·cloud" : "TTS·local"} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Avatar({ p }: { p: Persona }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-semibold text-white"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${p.accent}, ${p.accent2})`,
        boxShadow: `0 0 16px -2px ${p.accent}`,
        fontFamily: p.fontDisplay,
      }}
    >
      {p.glyph}
    </span>
  );
}

function Tier({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-1.5 py-0.5 text-[9px] text-[var(--ink-faint)]">
      {label}
    </span>
  );
}
