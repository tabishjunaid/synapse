// TS mirrors of the backend course schemas (hand-synced, like protocol.ts).

import type { SkillEdge, SkillNode } from "./classroomMock";

export type Level = "beginner" | "intermediate" | "advanced";
export type LessonShape = "intro" | "worked" | "guided" | "review" | "project";
export type LessonStatus = "locked" | "available" | "in_progress" | "mastered";

export interface GoalSpec {
  subject: string;
  target_outcome: string;
  level: Level;
  minutes_per_week: number;
  horizon: string;
  motivation: string;
}

export interface SkillRef {
  id: string;
  name: string;
}

export interface LessonView {
  id: string;
  order: number;
  title: string;
  shape: LessonShape;
  objectives: string[];
  skills: SkillRef[];
  est_minutes: number;
  grounded: boolean;
  status: LessonStatus;
  mastery: number;
}

export interface ModuleView {
  id: string;
  title: string;
  goal: string;
  lessons: LessonView[];
}

export interface Pacing {
  sessions_per_week: number;
  minutes_per_session: number;
  target_done_date: string | null;
}

export interface CourseView {
  course_id: string;
  title: string;
  summary: string;
  target_outcome: string;
  est_hours: number;
  pacing: Pacing;
  modules: ModuleView[];
  next_lesson_id: string | null;
  reviews_due: number;
}

export interface LessonDetail {
  course_id: string;
  course_title: string;
  module: { id: string; title: string; goal: string };
  lesson: {
    id: string;
    title: string;
    shape: LessonShape;
    objectives: string[];
    skills: SkillRef[];
    est_minutes: number;
    status: LessonStatus;
    mastery: number;
  };
}

export interface CompletionResult {
  recap: { covered: string; to_practise: string; next_time: string };
  skills: { skill_id: string; name: string; mastery: number }[];
  passed: boolean;
  next_lesson_id: string | null;
  pre_score?: number | null;
  post_score?: number;
  gain?: number | null;
}

// ---- Classroom (immersive view) wire shapes ----
// GET /api/lesson/{id}/constellation → { skills, edges } (note: key is `skills`).
export interface ConstellationData {
  skills: SkillNode[];
  edges: SkillEdge[];
}

// POST /api/writing-check → vision review (annotation/score optional/degrade-safe).
export interface WritingCheckResult {
  feedback: string;
  annotation: string | null;
  score: number | null;
}
