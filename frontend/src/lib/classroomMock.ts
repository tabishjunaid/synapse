// Mock lesson content for the classroom UI. Everything here is presentation
// data the backend will eventually own (learner model → constellation, lesson
// planner → board, glossary → deepen). Shapes are chosen to drop in cleanly.

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

/** A small mastery-gated skill graph. "due" = SRS resurfacing (a star that dims
 *  along the forgetting curve and re-brightens on practice). */
export const SKILL_NODES: SkillNode[] = [
  { id: "limits", label: "Limits", x: 0.16, y: 0.30, status: "mastered", mastery: 0.96 },
  { id: "continuity", label: "Continuity", x: 0.30, y: 0.66, status: "due", mastery: 0.58 },
  { id: "slope", label: "Slope at a point", x: 0.44, y: 0.24, status: "mastered", mastery: 0.91 },
  { id: "derivative", label: "The derivative", x: 0.58, y: 0.50, status: "current", mastery: 0.62 },
  { id: "rules", label: "Power rule", x: 0.74, y: 0.28, status: "locked", mastery: 0 },
  { id: "chain", label: "Chain rule", x: 0.82, y: 0.62, status: "locked", mastery: 0 },
  { id: "optimize", label: "Optimisation", x: 0.92, y: 0.40, status: "locked", mastery: 0 },
];

export const SKILL_EDGES: SkillEdge[] = [
  { from: "limits", to: "continuity" },
  { from: "limits", to: "slope" },
  { from: "slope", to: "derivative" },
  { from: "continuity", to: "derivative" },
  { from: "derivative", to: "rules" },
  { from: "derivative", to: "chain" },
  { from: "rules", to: "optimize" },
  { from: "chain", to: "optimize" },
];

export type DiagramKey = "derivative" | "freefall" | "arabic-letters" | "major-scale";

export interface BoardContent {
  title: string;
  diagram: DiagramKey;
  /** Optional MathML (rendered as static, controlled markup). */
  math?: string;
  note: string;
}

/** What the professor "writes" on the whiteboard, keyed by pack persona. */
export const BOARDS: Record<string, BoardContent> = {
  calculus: {
    title: "The derivative",
    diagram: "derivative",
    math: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
      <msup><mi>f</mi><mo>&#8242;</mo></msup><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>
      <munder><mo movablelimits="true">lim</mo><mrow><mi>h</mi><mo>&#8594;</mo><mn>0</mn></mrow></munder>
      <mfrac>
        <mrow><mi>f</mi><mo>(</mo><mi>x</mi><mo>+</mo><mi>h</mi><mo>)</mo><mo>&#8722;</mo><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo></mrow>
        <mi>h</mi>
      </mfrac>
    </math>`,
    note: "The slope of the tangent line — the instantaneous rate of change.",
  },
  physics: {
    title: "Free fall",
    diagram: "freefall",
    math: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
      <mi>a</mi><mo>=</mo><mfrac><mi>F</mi><mi>m</mi></mfrac><mo>=</mo>
      <mfrac><mrow><mi>m</mi><mi>g</mi></mrow><mi>m</mi></mfrac><mo>=</mo><mi>g</mi>
    </math>`,
    note: "Mass cancels — every object falls with the same acceleration g.",
  },
  arabic: {
    title: "اتصال الحروف",
    diagram: "arabic-letters",
    note: "تتغيّر صورة الحرف حسب موضعه في الكلمة: أوّل، وسط، آخِر.",
  },
  music: {
    title: "The major scale",
    diagram: "major-scale",
    note: "Whole, whole, half, whole, whole, whole, half — the same everywhere.",
  },
};

/** Tap-to-deepen glossary: term → a one-line Socratic expansion (mock micro-turn). */
export const GLOSSARY: Record<string, string> = {
  derivative: "A derivative is how fast something changes right now — the slope at a single instant.",
  tangent: "A tangent line just grazes the curve at one point, matching its direction there.",
  slope: "Slope is rise over run: how much the output moves per step of input.",
  limit: "A limit is the value a function heads toward as the input creeps to a target.",
  acceleration: "Acceleration is how quickly velocity changes — the derivative of velocity.",
  gravity: "Gravity pulls every mass the same way; near Earth it adds about 9.8 m/s of speed each second.",
  mass: "Mass measures how much stuff is in an object — and how hard it is to accelerate.",
  scale: "A scale is an ordered set of notes you build melodies and chords from.",
};

/** Natural backchannel fillers shown during the think gap (cold start / TTFT). */
export const THINKING_PHRASES = [
  "Let me think about how to put this…",
  "Good question — give me a second…",
  "Here's a nice way to see it…",
  "Mm, let's build that up slowly…",
];
