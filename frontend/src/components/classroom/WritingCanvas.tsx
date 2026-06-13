"use client";

// The writing surface. The learner works by hand; the professor reads the
// strokes (the canvas is rendered to an image → backend vision model) and the
// feedback lands here. Live: submitting POSTs the image to /api/writing-check.

import { useEffect, useRef, useState } from "react";

import { checkWriting } from "@/lib/classroomSource";
import type { WritingCheckResult } from "@/lib/types";

type Phase = "drawing" | "checking" | "checked";

export function WritingCanvas({ onClose, lessonId }: { onClose: () => void; lessonId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [phase, setPhase] = useState<Phase>("drawing");
  const [empty, setEmpty] = useState(true);
  const [result, setResult] = useState<WritingCheckResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const accent = getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#6aa9ff";
    ctx.strokeStyle = accent || "#fff";

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (phase !== "drawing") return;
      drawing.current = true;
      hasInk.current = true;
      setEmpty(false);
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const up = () => (drawing.current = false);

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [phase]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setEmpty(true);
    setResult(null);
    setPhase("drawing");
  };

  const check = async () => {
    const canvas = canvasRef.current;
    if (empty || !canvas) return;
    setPhase("checking");
    try {
      const image = canvas.toDataURL("image/png");
      setResult(await checkWriting(image, lessonId));
    } catch (e) {
      setResult({
        feedback: e instanceof Error ? e.message : String(e),
        annotation: null,
        score: null,
      });
    }
    setPhase("checked");
  };

  return (
    <div className="glass animate-rise-in flex w-full flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-2.5">
        <span className="text-sm font-medium text-[var(--ink)]">Write your answer</span>
        <button onClick={onClose} className="rounded-sm text-[var(--ink-faint)] transition hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" aria-label="Close writing canvas">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Writing canvas — draw or write your answer with a mouse or stylus"
          className="h-44 w-full touch-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(transparent, transparent 35px, rgba(255,255,255,0.06) 35px, rgba(255,255,255,0.06) 36px)",
          }}
        />
        {empty && phase === "drawing" && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[var(--ink-faint)]">
            Draw or write here with your mouse / stylus
          </span>
        )}

        {phase === "checked" && result?.score != null && (
          <div className="animate-rise-in absolute right-3 top-3 rounded-full bg-[rgba(52,210,166,0.15)] px-2.5 py-1 text-xs font-medium text-[#34d2a6]">
            {Math.round(result.score * 100)}%
          </div>
        )}
      </div>

      {/* The professor's real feedback on your writing. */}
      {phase === "checked" && result && (
        <div className="animate-rise-in border-t border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm text-[var(--ink-soft)]">
          {result.feedback}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button onClick={clear} className="rounded-full px-2 py-1 text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]">
          Clear
        </button>
        <button
          onClick={check}
          disabled={empty || phase !== "drawing"}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {phase === "checking" ? "Reading your writing…" : "Ask the professor to check"}
        </button>
      </div>
    </div>
  );
}
