"use client";

// The humble intervention. When the fused signal (camera + answer quality +
// latency) crosses a threshold, the professor *asks* rather than assuming. The
// concept doc's principle: "a wrong guess costs one polite question." One tap
// either way; never blocks the lesson.

interface EngagementCheckInProps {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
}

export function EngagementCheckIn({ visible, onYes, onNo }: EngagementCheckInProps) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="animate-rise-in glass pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2.5 shadow-xl"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
        style={{ background: "rgba(var(--glow),0.18)", color: "var(--accent)" }}
      >
        ?
      </span>
      <p className="text-sm text-[var(--ink)]">Want me to take that a little slower?</p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onYes}
          className="rounded-full px-3 py-1 text-sm font-medium text-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
          style={{ background: "var(--accent)" }}
        >
          Yes, slower
        </button>
        <button
          onClick={onNo}
          className="rounded-full px-3 py-1 text-sm text-[var(--ink-soft)] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        >
          I&apos;m good
        </button>
      </div>
    </div>
  );
}
