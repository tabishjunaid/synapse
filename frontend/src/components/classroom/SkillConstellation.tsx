"use client";

// The mastery-gated skill graph as a living night sky. Mastered skills are lit,
// the current one pulses, locked ones wait dim behind their prerequisites, and
// SRS shows as a star that has dimmed along the forgetting curve ("due" — ready
// to re-brighten on practice). Progression feels like lighting up a constellation.

import { useState } from "react";

import { SKILL_EDGES, SKILL_NODES, type SkillEdge, type SkillNode } from "@/lib/classroomMock";

const W = 360;
const H = 196;
const px = (x: number) => 16 + x * (W - 32);
const py = (y: number) => 14 + y * (H - 28);

export function SkillConstellation({
  nodes = SKILL_NODES,
  edges = SKILL_EDGES,
}: {
  nodes?: SkillNode[];
  edges?: SkillEdge[];
} = {}) {
  const [hover, setHover] = useState<string | null>(null);
  const byId = (id: string) => nodes.find((n) => n.id === id)!;
  const active =
    (hover ? byId(hover) : nodes.find((n) => n.status === "current")) ?? nodes[0];
  const masteredCount = nodes.filter((n) => n.status === "mastered").length;

  return (
    <div className="glass flex flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-2.5">
        <span className="text-sm font-medium text-[var(--ink)]">Your path</span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">mastery map</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Skill map: ${masteredCount} of ${nodes.length} skills mastered. Currently learning ${
          nodes.find((n) => n.status === "current")?.label ?? "—"
        }.`}
      >
        {edges.map((e, i) => {
          const a = byId(e.from);
          const b = byId(e.to);
          const lit = a.status === "mastered" || a.status === "due";
          return (
            <line
              key={i}
              x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)}
              stroke={lit ? "rgba(var(--glow),0.35)" : "rgba(255,255,255,0.08)"}
              strokeWidth="1"
              strokeDasharray={b.status === "locked" ? "3 4" : undefined}
            />
          );
        })}

        {nodes.map((n) => (
          <Star key={n.id} n={n} onHover={setHover} />
        ))}
      </svg>

      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1 text-xs">
        <div>
          <span className="font-medium text-[var(--ink)]">{active.label}</span>
          <span className="ml-2 text-[var(--ink-soft)]">
            {active.status === "locked"
              ? "locked"
              : active.status === "due"
                ? `due for review · ${Math.round(active.mastery * 100)}%`
                : `${Math.round(active.mastery * 100)}% mastered`}
          </span>
        </div>
        <span className="text-[var(--ink-faint)]">Power rule unlocks at 90%</span>
      </div>
    </div>
  );
}

function Star({ n, onHover }: { n: SkillNode; onHover: (id: string | null) => void }) {
  const x = px(n.x);
  const y = py(n.y);
  const r = 3 + n.mastery * 4;
  const accent = "var(--accent)";

  const fill =
    n.status === "locked"
      ? "transparent"
      : n.status === "due"
        ? "rgba(var(--glow),0.5)"
        : accent;

  const detail =
    n.status === "locked"
      ? "locked"
      : n.status === "due"
        ? `due for review, ${Math.round(n.mastery * 100)} percent`
        : `${Math.round(n.mastery * 100)} percent mastered`;

  return (
    <g
      className="cursor-pointer focus:outline-none"
      tabIndex={0}
      role="button"
      aria-label={`${n.label}: ${detail}`}
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(n.id)}
      onBlur={() => onHover(null)}
      onClick={() => onHover(n.id)}
    >
      {n.status === "current" && (
        <circle cx={x} cy={y} r={r} fill="none" stroke={accent} strokeWidth="1.5" style={{ transformOrigin: `${x}px ${y}px`, animation: "pulse-ring 2s ease-out infinite" }} />
      )}
      <circle
        cx={x}
        cy={y}
        r={n.status === "locked" ? 3.5 : r}
        fill={fill}
        stroke={n.status === "locked" ? "rgba(255,255,255,0.25)" : "transparent"}
        strokeWidth="1.5"
        style={{
          filter: n.status === "mastered" || n.status === "current" ? "drop-shadow(0 0 6px var(--accent))" : undefined,
          animation: n.status === "due" ? "twinkle 2.4s ease-in-out infinite" : undefined,
          opacity: n.status === "locked" ? 0.6 : 1,
        }}
      />
      <text
        x={x}
        y={y + r + 12}
        textAnchor="middle"
        className="select-none"
        style={{ fontSize: 9, fill: n.status === "locked" ? "var(--ink-faint)" : "var(--ink-soft)" }}
      >
        {n.label}
      </text>
    </g>
  );
}
