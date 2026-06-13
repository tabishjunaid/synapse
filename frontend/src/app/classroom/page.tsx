"use client";

// The classroom — a lecture-hall "stage" with the professor as a living presence.
// Composes all seven UI directions over the real Phase 0 voice loop
// (useSpikeSession); backend-dependent signals (engagement, board, mastery,
// packs) are realistic mocks, swappable for real data later.

import { useCallback, useEffect, useRef, useState } from "react";

import { CaptionStrip } from "@/components/classroom/CaptionStrip";
import { DebugHUD } from "@/components/classroom/DebugHUD";
import { DeepenText } from "@/components/classroom/DeepenText";
import { EngagementCheckIn } from "@/components/classroom/EngagementCheckIn";
import { PackSwitcher } from "@/components/classroom/PackSwitcher";
import { PerceptionRibbon } from "@/components/classroom/PerceptionRibbon";
import { PresenceOrb, type OrbMode } from "@/components/classroom/PresenceOrb";
import { RungIndicator } from "@/components/classroom/RungIndicator";
import { SkillConstellation } from "@/components/classroom/SkillConstellation";
import { VideoTile } from "@/components/classroom/VideoTile";
import { Whiteboard } from "@/components/classroom/Whiteboard";
import { WritingCanvas } from "@/components/classroom/WritingCanvas";
import { THINKING_PHRASES } from "@/lib/classroomMock";
import { useClassroomData } from "@/lib/classroomSource";
import { PERSONAS, personaVars } from "@/lib/personas";
import { useDismissable } from "@/lib/useDismissable";
import { useSpikeSession } from "@/lib/useSpikeSession";

export default function ClassroomPage() {
  const { state, levelRef, start, startMic, stopMic, sendTyped } = useSpikeSession();

  const [persona, setPersona] = useState(PERSONAS[0]);
  const [revealKey, setRevealKey] = useState(0);
  const [typed, setTyped] = useState("");
  const [writing, setWriting] = useState(false);
  const [debug, setDebug] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [engagement, setEngagement] = useState(0.82);
  // Marks a send awaiting its server turn. Derived (not effect-cleared): once a
  // new turn appears, turn count moves past the snapshot and "awaiting" goes false.
  const [sentAtTurns, setSentAtTurns] = useState<number | null>(null);
  const [checkInSnoozed, setCheckInSnoozed] = useState(false);
  // On phones the right rail (whiteboard + mastery map) is hidden; this surfaces it in a sheet.
  const [boardOpen, setBoardOpen] = useState(false);
  const closeBoard = useCallback(() => setBoardOpen(false), []);
  const boardSheetRef = useDismissable<HTMLDivElement>(boardOpen, closeBoard);
  const wantMic = useRef(false);

  // ---- derive the professor's presence from the live session ----
  const last = state.turns[state.turns.length - 1];
  const streaming = !!last && !last.done && !!last.teacherText;
  const awaiting = sentAtTurns !== null && state.turns.length === sentAtTurns;
  const thinking = awaiting || (!!last && !last.done && !last.teacherText);
  const mode: OrbMode = streaming
    ? "speaking"
    : thinking
      ? "thinking"
      : state.micStatus === "on"
        ? "listening"
        : "idle";

  const teacherText = last ? last.teacherText : persona.openingLine;
  const learnerText = last?.learnerText ?? "";
  const thinkingPhrase = THINKING_PHRASES[state.turns.length % THINKING_PHRASES.length];
  // Classroom data (board, constellation, glossary, packs) — mocks by default,
  // live behind NEXT_PUBLIC_SYNAPSE_CLASSROOM_LIVE. A lesson-bound classroom route
  // would pass its lessonId here to source per-lesson artifacts live.
  const data = useClassroomData(persona.id);
  const board = data.board;

  // One-click mic: warm the STT model, then open the mic when it's ready.
  useEffect(() => {
    if (wantMic.current && state.sttStatus === "ready" && state.micStatus === "off") {
      wantMic.current = false;
      startMic();
    }
    if (state.sttStatus === "error") wantMic.current = false;
  }, [state.sttStatus, state.micStatus, startMic]);

  // Simulated on-device engagement signal (stands in for MediaPipe).
  useEffect(() => {
    if (!cameraOn) return;
    const id = window.setInterval(() => {
      const t = performance.now() / 1000;
      const base = 0.7 + 0.2 * Math.sin(t / 3.5);
      const dip = Math.sin(t / 6.5) < -0.82 ? 0.34 : 0;
      setEngagement(Math.max(0.3, Math.min(0.97, base - dip)));
    }, 500);
    return () => window.clearInterval(id);
  }, [cameraOn]);

  const beginVoice = () => {
    if (state.micStatus === "on") {
      stopMic();
      return;
    }
    wantMic.current = true;
    start();
  };

  const send = useCallback(
    (text: string) => {
      setSentAtTurns(state.turns.length);
      sendTyped(text);
    },
    [sendTyped, state.turns.length],
  );

  const switchPersona = (p: typeof persona) => {
    setPersona(p);
    setRevealKey((k) => k + 1);
  };

  // ⌘. toggles the debug HUD.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setDebug((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showCheckIn = cameraOn && engagement < 0.46 && !thinking && !checkInSnoozed;
  const dismissCheckIn = () => {
    setCheckInSnoozed(true);
    window.setTimeout(() => setCheckInSnoozed(false), 14000);
  };

  return (
    <main
      className="stage relative flex h-screen flex-col overflow-hidden"
      style={personaVars(persona)}
      dir={persona.dir}
    >
      {/* ---- top bar ---- */}
      <header className="z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <PackSwitcher personas={data.packs} current={persona} onChange={switchPersona} />
        <div className="hidden items-center gap-2 md:flex">
          <PerceptionRibbon
            listening={state.micStatus === "on"}
            cameraOn={cameraOn}
            reading={writing}
            engagement={engagement}
          />
        </div>
        <div className="flex items-center gap-2">
          <RungIndicator state={state} />
          <button
            onClick={() => setBoardOpen(true)}
            className="grid h-7 w-7 place-items-center rounded-full border border-[rgba(255,255,255,0.1)] text-[var(--ink-soft)] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] lg:hidden"
            title="Show board & progress"
            aria-label="Show whiteboard and progress"
            aria-haspopup="dialog"
            aria-expanded={boardOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="13" rx="1.5" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </button>
          <button
            onClick={() => setDebug((v) => !v)}
            className="grid h-7 w-7 place-items-center rounded-full border border-[rgba(255,255,255,0.1)] text-[var(--ink-soft)] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
            title="Latency debug HUD (⌘.)"
            aria-label="Toggle debug HUD"
            aria-pressed={debug}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20v-6M6 20v-2M18 20v-10M6 12V4M12 8V4M18 6V4" />
            </svg>
          </button>
        </div>
      </header>

      {/* ---- body: stage + rail ---- */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-6">
        <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center">
          <div className="absolute end-0 top-0">
            <VideoTile engagement={engagement} onCameraChange={setCameraOn} />
          </div>

          <div className="flex flex-col items-center gap-8">
            <PresenceOrb mode={mode} levelRef={levelRef} glyph={persona.glyph} />
            <CaptionStrip
              teacherText={teacherText}
              learnerText={learnerText}
              mode={mode}
              thinkingPhrase={thinkingPhrase}
              streaming={streaming}
              turnKey={last?.id ?? `opening-${persona.id}`}
              renderTeacher={(t) => <DeepenText text={t} glossary={data.glossary} />}
            />
          </div>

          {/* check-in floats above the dock */}
          <div className="pointer-events-none absolute bottom-28 flex w-full justify-center">
            <EngagementCheckIn
              visible={showCheckIn}
              onYes={dismissCheckIn}
              onNo={dismissCheckIn}
            />
          </div>

          {/* writing canvas slides in above the dock */}
          {writing && (
            <div className="absolute bottom-24 w-full max-w-xl px-2">
              <WritingCanvas onClose={() => setWriting(false)} />
            </div>
          )}

          {/* ---- input dock ---- */}
          <div className="absolute bottom-0 w-full max-w-xl px-2">
            <div className="glass flex items-center gap-2 rounded-2xl p-2">
              <MicButton
                micOn={state.micStatus === "on"}
                warming={state.sttStatus === "loading"}
                onClick={beginVoice}
              />
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) {
                    send(typed.trim());
                    setTyped("");
                  }
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Ask a question, or just talk…"
                  aria-label="Ask a question, or just talk"
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:opacity-30"
                  style={{ background: "var(--accent)" }}
                >
                  {state.wsStatus === "connecting" ? "…" : "Send"}
                </button>
              </form>
              <button
                onClick={() => setWriting((v) => !v)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                  writing ? "border-[rgba(var(--glow),0.4)] text-[var(--accent)]" : "border-[rgba(255,255,255,0.1)] text-[var(--ink-soft)] hover:bg-white/5"
                }`}
                title="Write your answer"
                aria-label="Toggle writing canvas"
                aria-pressed={writing}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7-4-4-7 7v4h4Z" />
                  <path d="M16 6l2-2 4 4-2 2" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ---- right rail ---- */}
        <aside className="hidden w-[360px] shrink-0 flex-col gap-4 lg:flex">
          <div className="min-h-0 flex-1">
            <Whiteboard board={board} revealKey={revealKey} />
          </div>
          <SkillConstellation nodes={data.constellation.skills} edges={data.constellation.edges} />
        </aside>
      </div>

      {/* ---- mobile board sheet: surfaces the right rail on phones/tablets ---- */}
      {boardOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
          <div
            ref={boardSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Whiteboard and progress"
            className="glass animate-rise-in scroll-soft absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-3xl p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--ink)]">Board &amp; progress</span>
              <button
                onClick={closeBoard}
                aria-label="Close board"
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--ink-faint)] transition hover:bg-white/5 hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <Whiteboard board={board} revealKey={revealKey} />
            <SkillConstellation nodes={data.constellation.skills} edges={data.constellation.edges} />
          </div>
        </div>
      )}

      <DebugHUD state={state} open={debug} onClose={() => setDebug(false)} />
    </main>
  );
}

function MicButton({ micOn, warming, onClick }: { micOn: boolean; warming: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      style={{ background: micOn ? "#ff6b6b" : "var(--accent)" }}
      title={micOn ? "Stop microphone" : "Start talking"}
      aria-label={micOn ? "Stop microphone" : "Start talking"}
      aria-pressed={micOn}
    >
      {micOn ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
        </svg>
      )}
      {warming && (
        <span className="absolute -inset-0.5 rounded-xl border-2 border-black/30" style={{ animation: "halo-pulse 1.2s ease-in-out infinite" }} />
      )}
    </button>
  );
}
