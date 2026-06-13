"use client";

// The "sees you" surface — a small self-view with an engagement aura. The aura's
// warmth tracks the on-device engagement score (here simulated; later from
// MediaPipe Face Landmarker). A standing badge reminds the learner the video
// never leaves the machine. Camera is opt-in and toggleable at any time.

import { useEffect, useRef, useState } from "react";

interface VideoTileProps {
  engagement: number;
  onCameraChange?: (on: boolean) => void;
}

export function VideoTile({ engagement, onCameraChange }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    onCameraChange?.(on);
    if (!on) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  useEffect(
    () => () => streamRef.current?.getTracks().forEach((t) => t.stop()),
    [],
  );

  // Aura: greener/brighter when engaged, cooler/dim when drifting.
  const eng = Math.max(0, Math.min(1, engagement));
  const auraColor = eng > 0.55 ? "var(--accent)" : "rgba(255,255,255,0.3)";

  return (
    <div className="relative w-44">
      <div
        className="absolute -inset-1 rounded-2xl"
        style={{
          background: `radial-gradient(circle, ${auraColor}, transparent 70%)`,
          opacity: on ? 0.25 + eng * 0.5 : 0.12,
          filter: "blur(10px)",
          animation: on ? "engagement-aura 3.5s ease-in-out infinite" : undefined,
        }}
      />
      <div className="glass relative aspect-[4/3] overflow-hidden rounded-2xl">
        {on && !error ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-center text-[var(--ink-faint)]">
            <div>
              <FaceGlyph />
              <p className="mt-1 px-3 text-[11px] leading-tight">
                {error ? "Camera unavailable" : "Camera off"}
              </p>
            </div>
          </div>
        )}

        {/* On-device badge */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-[var(--ink-soft)] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d2a6" }} />
          on-device
        </div>

        {/* Engagement read-out */}
        {on && (
          <div className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-[var(--ink-soft)] backdrop-blur">
            engagement {Math.round(eng * 100)}%
          </div>
        )}

        <button
          onClick={() => setOn((v) => !v)}
          className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-[var(--ink)] backdrop-blur transition hover:bg-black/70"
          aria-label={on ? "Turn camera off" : "Turn camera on"}
        >
          {on ? <CamOff /> : <CamOn />}
        </button>
      </div>
    </div>
  );
}

function FaceGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto opacity-50">
      <circle cx="12" cy="9" r="4" />
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
function CamOn() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 7h11v10H2z" />
      <path d="M16 10l6-3v10l-6-3" />
    </svg>
  );
}
function CamOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 7h9v10H2z" />
      <path d="M16 10l6-3v10l-6-3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
