// Classroom wire types + UI copy. The DATA the classroom shows (constellation,
// board, glossary, packs) is served live by the backend (see api.ts); this file
// only holds the shapes those endpoints return and the loading-state copy.

export type SkillStatus = "mastered" | "current" | "due" | "locked";

export interface SkillNode {
  id: string;
  label: string;
  /** Position within a 0..1 box; the constellation scales it to the viewport. */
  x: number;
  y: number;
  status: SkillStatus;
  /** 0..1 — drives the star's brightness/size. */
  mastery: number;
}

export interface SkillEdge {
  from: string;
  to: string;
}

export type DiagramKey = "derivative" | "freefall" | "arabic-letters" | "major-scale";

export interface BoardContent {
  title: string;
  /** One of the known diagram keys, or "" when the lesson isn't diagrammatic. */
  diagram: DiagramKey | "";
  /** Optional MathML (rendered as static, controlled markup). */
  math?: string;
  note: string;
}

/** Natural backchannel fillers shown during the think gap (cold start / TTFT).
 *  UI copy, not lesson data — there's no backend for spinner text. */
export const THINKING_PHRASES = [
  "Let me think about how to put this…",
  "Good question — give me a second…",
  "Here's a nice way to see it…",
  "Mm, let's build that up slowly…",
];
