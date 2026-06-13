"use client";

// The whiteboard that draws itself. As the professor explains, the diagram is
// stroked on progressively (SVG path-length animation) and the equation writes
// in — the visual arrives at the speed of speech, not after it. Content is
// pack-driven (mock here); the diagrams are hand-built SVG keyed by the lesson.

import type { BoardContent, DiagramKey } from "@/lib/classroomMock";

interface WhiteboardProps {
  board: BoardContent;
  /** Bumped by the parent to replay the draw-on animation for a new board. */
  revealKey: number;
}

export function Whiteboard({ board, revealKey }: WhiteboardProps) {
  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BoardIcon />
          <span className="text-sm font-medium text-[var(--ink)]">{board.title}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">whiteboard</span>
      </div>

      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-4 p-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        <div key={revealKey} className="flex flex-col items-center gap-4">
          <Diagram which={board.diagram} />
          {board.math && (
            <div
              className="animate-fade-up text-[var(--ink)] [&_math]:text-xl"
              style={{ animationDelay: "0.9s" }}
              dangerouslySetInnerHTML={{ __html: board.math }}
            />
          )}
          <p
            className="animate-fade-up max-w-xs text-center text-sm text-[var(--ink-soft)]"
            style={{ animationDelay: "1.15s" }}
          >
            {board.note}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Each path uses pathLength=1 so a single dash trick animates the stroke on. */
function drawn(delay: number, duration = 0.9): React.CSSProperties {
  return {
    strokeDasharray: 1,
    strokeDashoffset: 1,
    animation: `draw-stroke ${duration}s ease forwards`,
    animationDelay: `${delay}s`,
  };
}

function Diagram({ which }: { which: DiagramKey | "" }) {
  const stroke = "var(--accent)";
  if (!which) return null; // non-diagrammatic lesson — board shows title/note only
  switch (which) {
    case "derivative":
      return (
        <svg width="240" height="150" viewBox="0 0 240 150" fill="none">
          <path d="M20 130 H225" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" pathLength={1} style={drawn(0)} />
          <path d="M30 140 V15" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" pathLength={1} style={drawn(0.1)} />
          <path d="M30 120 Q110 120 130 70 T210 20" stroke={stroke} strokeWidth="2.5" pathLength={1} style={drawn(0.4, 1.1)} />
          <path d="M70 128 L185 44" stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="5 4" pathLength={1} style={drawn(1.0)} />
          <circle cx="130" cy="70" r="4" fill={stroke} style={{ ...drawn(1.6), strokeDasharray: undefined }} />
        </svg>
      );
    case "freefall":
      return (
        <svg width="240" height="150" viewBox="0 0 240 150" fill="none">
          <path d="M20 135 H220" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" pathLength={1} style={drawn(0)} />
          <circle cx="80" cy="40" r="12" stroke={stroke} strokeWidth="2.5" pathLength={1} style={drawn(0.3)} />
          <rect x="148" y="28" width="24" height="24" rx="3" stroke="var(--accent-2)" strokeWidth="2.5" pathLength={1} style={drawn(0.5)} />
          <path d="M80 58 V110" stroke={stroke} strokeWidth="2" pathLength={1} style={drawn(0.9)} />
          <path d="M160 56 V110" stroke="var(--accent-2)" strokeWidth="2" pathLength={1} style={drawn(0.9)} />
          <path d="M74 104 l6 8 l6 -8" stroke={stroke} strokeWidth="2" pathLength={1} style={drawn(1.2)} />
          <path d="M154 104 l6 8 l6 -8" stroke="var(--accent-2)" strokeWidth="2" pathLength={1} style={drawn(1.2)} />
        </svg>
      );
    case "arabic-letters":
      return (
        <svg width="240" height="120" viewBox="0 0 240 120" fill="none">
          <path d="M210 70 q-15 -40 -35 0 q-5 18 12 18" stroke={stroke} strokeWidth="3" pathLength={1} style={drawn(0.2, 1)} />
          <path d="M150 70 q-20 -35 -40 0 q 20 22 40 0" stroke="var(--accent-2)" strokeWidth="3" pathLength={1} style={drawn(0.7, 1)} />
          <path d="M95 70 q-22 -30 -45 0" stroke={stroke} strokeWidth="3" pathLength={1} style={drawn(1.2, 1)} />
          <path d="M40 90 H215" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="3 4" pathLength={1} style={drawn(0)} />
        </svg>
      );
    case "major-scale":
      return (
        <svg width="252" height="120" viewBox="0 0 252 120" fill="none">
          {Array.from({ length: 7 }).map((_, i) => (
            <rect
              key={i}
              x={12 + i * 34}
              y={20}
              width="30"
              height="80"
              rx="4"
              stroke={i === 0 ? stroke : "rgba(255,255,255,0.3)"}
              fill={i === 0 ? "rgba(var(--glow),0.15)" : "transparent"}
              strokeWidth="2"
              pathLength={1}
              style={drawn(0.15 * i)}
            />
          ))}
        </svg>
      );
  }
}

function BoardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
