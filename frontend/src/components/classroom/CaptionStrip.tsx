"use client";

// Eyes-up teleprompter. Voice-first means the screen shouldn't demand reading —
// so the focus is one large current line, not a scrolling chat log. During the
// think gap we show an anticipatory backchannel instead of dead air.

import type { OrbMode } from "./PresenceOrb";

interface CaptionStripProps {
  teacherText: string;
  learnerText: string;
  mode: OrbMode;
  thinkingPhrase: string;
  streaming: boolean;
  /** Stable per-turn identity so the entrance animation plays once per turn, not
      on every streamed delta or when two turns share their first few characters. */
  turnKey?: string | number;
  /** Children of the teacher line can be enriched (tap-to-deepen) by the parent. */
  renderTeacher?: (text: string) => React.ReactNode;
}

export function CaptionStrip({
  teacherText,
  learnerText,
  mode,
  thinkingPhrase,
  streaming,
  turnKey,
  renderTeacher,
}: CaptionStripProps) {
  const showThinking = mode === "thinking" && !teacherText;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-3 text-center">
      {learnerText && (
        <p className="text-sm text-[var(--ink-faint)]">
          <span className="opacity-60">You said·</span> {learnerText}
        </p>
      )}

      {showThinking ? (
        <p className="thinking-dots text-xl font-medium text-[var(--ink-soft)] sm:text-2xl">
          {thinkingPhrase}
          <span className="accent-text">.</span>
          <span className="accent-text">.</span>
          <span className="accent-text">.</span>
        </p>
      ) : (
        <p
          key={turnKey ?? teacherText.slice(0, 12)}
          className="animate-caption-in text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-[1.9rem]"
        >
          {teacherText ? (
            renderTeacher ? renderTeacher(teacherText) : teacherText
          ) : (
            <span className="text-[var(--ink-faint)]">
              Press the mic, or type below, to begin the lesson.
            </span>
          )}
          {streaming && (
            <span
              className="accent-text ml-0.5 inline-block"
              style={{ animation: "blink-caret 1s step-end infinite" }}
            >
              ▍
            </span>
          )}
        </p>
      )}
    </div>
  );
}
