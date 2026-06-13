import type { LessonShape, LessonStatus } from "./types";

export const SHAPE_LABEL: Record<LessonShape, string> = {
  intro: "Concept",
  worked: "Worked example",
  guided: "Guided practice",
  review: "Review",
  project: "Project",
};

export const STATUS_TONE: Record<LessonStatus, "muted" | "accent" | "warning" | "success"> = {
  locked: "muted",
  available: "accent",
  in_progress: "warning",
  mastered: "success",
};

export const STATUS_LABEL: Record<LessonStatus, string> = {
  locked: "Locked",
  available: "Start",
  in_progress: "In progress",
  mastered: "Mastered",
};
