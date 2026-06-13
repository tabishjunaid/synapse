"use client";

// Tap-to-deepen. Any term the glossary knows becomes a quiet invitation: tap it
// for a one-line Socratic expansion without derailing the main thread. Later,
// terms the learner model flags as un-mastered get the underline; for now the
// glossary stands in. Used in both the live caption and the transcript.

import { useCallback, useMemo, useState } from "react";

import { useDismissable } from "@/lib/useDismissable";

export function DeepenText({
  text,
  glossary = {},
}: {
  text: string;
  glossary?: Record<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const rootRef = useDismissable<HTMLSpanElement>(open !== null, close);
  // Longest-first so multi-word terms win over their substrings.
  const terms = useMemo(() => Object.keys(glossary).sort((a, b) => b.length - a.length), [glossary]);
  // Empty glossary → nothing to enrich; also avoids an empty-alternation regex.
  if (terms.length === 0) return <>{text}</>;
  // Fresh regex per render — no shared mutable lastIndex to trip the rules of React.
  const termRe = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = termRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const term = m[0];
    const id = term.toLowerCase();
    const isOpen = open === id;
    const tipId = `deepen-${id}`;
    parts.push(
      <span key={key++} className="relative inline-block">
        <button
          onClick={() => setOpen(isOpen ? null : id)}
          aria-expanded={isOpen}
          aria-controls={tipId}
          className="rounded-sm underline decoration-dotted decoration-[var(--accent)] underline-offset-4 transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ textDecorationThickness: "1.5px" }}
        >
          {term}
        </button>
        {isOpen && (
          <span
            id={tipId}
            className="glass animate-rise-in absolute left-1/2 top-[calc(100%+8px)] z-30 w-60 -translate-x-1/2 rounded-xl p-3 text-left text-sm font-normal leading-relaxed text-[var(--ink-soft)]"
            role="tooltip"
          >
            <span className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              {term}
            </span>
            {glossary[id]}
          </span>
        )}
      </span>,
    );
    last = m.index + term.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span ref={rootRef}>{parts}</span>;
}
