"use client";

// The professor's presence — one living focal element instead of status chips.
//   idle      → a slow breath
//   listening → the core swells with your live mic level (read via rAF, not state)
//   thinking  → an inward swirl; the latency budget felt as pondering, not a number
//   speaking  → concentric rings ride a soft waveform
// Reuses levelRef from useSpikeSession so it reacts to the real microphone.

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

export type OrbMode = "idle" | "listening" | "thinking" | "speaking";

interface PresenceOrbProps {
  mode: OrbMode;
  /** Live mic RMS (~0..0.3); only read while listening. */
  levelRef: React.RefObject<number>;
  glyph: string;
  size?: number;
}

export function PresenceOrb({ mode, levelRef, glyph, size = 232 }: PresenceOrbProps) {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    // Honor reduced-motion: leave the orb in its CSS resting state, no rAF transforms.
    if (reducedMotion) {
      coreRef.current?.style.removeProperty("transform");
      haloRef.current?.style.removeProperty("opacity");
      return;
    }
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      const m = modeRef.current;
      const core = coreRef.current;
      const halo = haloRef.current;
      if (core && halo) {
        if (m === "listening") {
          const lvl = Math.min(1, (levelRef.current ?? 0) / 0.18);
          const s = 1 + lvl * 0.5;
          core.style.transform = `scale(${s.toFixed(3)})`;
          halo.style.opacity = (0.35 + lvl * 0.5).toFixed(3);
        } else if (m === "speaking") {
          const s = 1 + Math.sin(t / 7) * 0.06 + Math.sin(t / 3.3) * 0.02;
          core.style.transform = `scale(${s.toFixed(3)})`;
          halo.style.opacity = (0.5 + Math.sin(t / 7) * 0.2).toFixed(3);
          if (ring1Ref.current)
            ring1Ref.current.style.transform = `scale(${(1.2 + Math.sin(t / 9) * 0.12).toFixed(3)})`;
          if (ring2Ref.current)
            ring2Ref.current.style.transform = `scale(${(1.45 + Math.sin(t / 9 + 1) * 0.12).toFixed(3)})`;
        } else {
          core.style.transform = "scale(1)";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, reducedMotion]);

  const speaking = mode === "speaking";
  const thinking = mode === "thinking";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* Outer halo */}
      <div
        ref={haloRef}
        className="absolute rounded-full blur-2xl"
        style={{
          width: size,
          height: size,
          background: "radial-gradient(circle, rgba(var(--glow),0.55), transparent 65%)",
          opacity: 0.4,
          animation: mode === "idle" ? "halo-pulse 5s ease-in-out infinite" : undefined,
        }}
      />
      {/* Speaking rings */}
      {speaking && (
        <>
          <div ref={ring1Ref} className="absolute rounded-full" style={ringStyle(size)} />
          <div ref={ring2Ref} className="absolute rounded-full" style={ringStyle(size)} />
        </>
      )}
      {/* Thinking swirl */}
      {thinking && (
        <div
          className="absolute rounded-full"
          style={{
            width: size * 0.92,
            height: size * 0.92,
            background:
              "conic-gradient(from 0deg, transparent, rgba(var(--glow),0.55), transparent 55%)",
            animation: "think-swirl 1.6s linear infinite",
            maskImage: "radial-gradient(circle, transparent 58%, black 60%)",
            WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 60%)",
          }}
        />
      )}
      {/* Core sphere */}
      <div
        ref={coreRef}
        className="relative grid place-items-center rounded-full transition-transform"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          background:
            "radial-gradient(35% 35% at 35% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0.15) 40%, transparent 60%), radial-gradient(circle at 50% 50%, var(--accent), var(--accent-2))",
          boxShadow:
            "0 0 60px -6px rgba(var(--glow),0.7), inset 0 0 40px rgba(255,255,255,0.12)",
          animation: mode === "idle" ? "breathe 4.5s ease-in-out infinite" : undefined,
        }}
      >
        <span
          className="select-none text-3xl font-semibold text-white/90"
          style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
        >
          {glyph}
        </span>
      </div>
    </div>
  );
}

function ringStyle(size: number): React.CSSProperties {
  return {
    width: size * 0.62,
    height: size * 0.62,
    border: "1px solid rgba(var(--glow),0.4)",
  };
}
