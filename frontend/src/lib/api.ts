// REST client for the course layer. Base URL via NEXT_PUBLIC_SYNAPSE_API.

import type { BoardContent } from "./classroomMock";
import type { Persona } from "./personas";
import type {
  CompletionResult,
  ConstellationData,
  CourseView,
  GoalSpec,
  LessonDetail,
  WritingCheckResult,
} from "./types";

const API = process.env.NEXT_PUBLIC_SYNAPSE_API ?? "http://localhost:8765";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => b?.detail)
      .catch(() => null);
    throw new Error(detail ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const createGoal = (spec: GoalSpec) =>
  req<{ goal_id: string; learner_id: string }>("/api/goal", {
    method: "POST",
    body: JSON.stringify({ spec }),
  });

export const getPlacement = (goal_id: string) =>
  req<{ questions: { id: string; prompt: string }[] }>("/api/placement", {
    method: "POST",
    body: JSON.stringify({ goal_id }),
  });

export const generateCourse = (
  goal_id: string,
  placement_answers: { question: string; answer: string }[] = [],
) =>
  req<CourseView>("/api/course/generate", {
    method: "POST",
    body: JSON.stringify({ goal_id, placement_answers }),
  });

export const getCourse = () => req<{ course: CourseView | null }>("/api/course");

export const getLesson = (id: string) => req<LessonDetail>(`/api/lesson/${id}`);

export const getLessonQuiz = (id: string) =>
  req<{ questions: { id: string; prompt: string }[] }>(`/api/lesson/${id}/quiz`);

export const submitPreQuiz = (id: string, answers: { question: string; answer: string }[]) =>
  req<{ score: number }>(`/api/lesson/${id}/quiz/pre`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

export const completeLesson = (id: string, transcript: { role: string; content: string }[]) =>
  req<CompletionResult>(`/api/lesson/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });

export const resetCourse = () => req<{ ok: boolean }>("/api/course/reset", { method: "POST" });

// ---- Classroom (immersive view) ----
// Envelope normalization lives here so callers get the bare shape the UI wants:
// packs unwrap from { packs }, glossary from { terms }, constellation keeps { skills, edges }.

export const getKnowledgePacks = () =>
  req<{ packs: Persona[] }>("/api/knowledge-packs").then((r) => r.packs);

export const getBoard = (lessonId: string) =>
  req<BoardContent>(`/api/lesson/${lessonId}/board`);

export const getGlossary = (lessonId: string) =>
  req<{ terms: Record<string, string> }>(`/api/lesson/${lessonId}/glossary`).then((r) => r.terms);

export const getConstellation = (lessonId: string) =>
  req<ConstellationData>(`/api/lesson/${lessonId}/constellation`);

export const postWritingCheck = (image: string, lesson_id?: string) =>
  req<WritingCheckResult>("/api/writing-check", {
    method: "POST",
    body: JSON.stringify({ image, lesson_id }),
  });
