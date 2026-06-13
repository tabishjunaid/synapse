"use client";

// The single source-of-truth switch for classroom data. Today the classroom runs
// on the mocks in classroomMock.ts / personas.ts; the backend exposes matching
// endpoints (see api.ts). Flip NEXT_PUBLIC_SYNAPSE_CLASSROOM_LIVE=1 to source the
// data live — the components don't change, they just consume this hook.
//
// Per-lesson artifacts (board, glossary, constellation) need a lessonId; the
// standalone /classroom demo has none, so those stay on mocks even when live,
// while knowledge-packs (which need no lesson) go live. A future lesson-bound
// classroom route passes lessonId through and the whole surface goes live.

import { useEffect, useState } from "react";

import {
  getBoard,
  getConstellation,
  getGlossary,
  getKnowledgePacks,
  postWritingCheck,
} from "./api";
import {
  BOARDS,
  GLOSSARY,
  SKILL_EDGES,
  SKILL_NODES,
  type BoardContent,
} from "./classroomMock";
import { PERSONAS, type Persona } from "./personas";
import type { ConstellationData, WritingCheckResult } from "./types";

export const CLASSROOM_LIVE = process.env.NEXT_PUBLIC_SYNAPSE_CLASSROOM_LIVE === "1";

const MOCK_CONSTELLATION: ConstellationData = { skills: SKILL_NODES, edges: SKILL_EDGES };
const mockBoardFor = (personaId: string): BoardContent => BOARDS[personaId] ?? BOARDS.calculus;

export interface ClassroomData {
  packs: Persona[];
  board: BoardContent;
  constellation: ConstellationData;
  glossary: Record<string, string>;
  loading: boolean;
  error: string | null;
}

/**
 * Returns classroom data from mocks (default) or live endpoints (flag on).
 * Mocks are always the synchronous fallback, so the UI never flashes empty and
 * behaviour is byte-identical to today when the flag is off.
 */
export function useClassroomData(personaId: string, lessonId?: string): ClassroomData {
  const [live, setLive] = useState<Omit<ClassroomData, "loading" | "error"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLASSROOM_LIVE) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) setError(null);
        // Packs need no lesson; per-lesson artifacts require a lessonId.
        const packs = await getKnowledgePacks();
        const [board, constellation, glossary] = lessonId
          ? await Promise.all([
              getBoard(lessonId),
              getConstellation(lessonId),
              getGlossary(lessonId),
            ])
          : [mockBoardFor(personaId), MOCK_CONSTELLATION, GLOSSARY];
        if (!cancelled) setLive({ packs, board, constellation, glossary });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, personaId]);

  if (!CLASSROOM_LIVE) {
    return {
      packs: PERSONAS,
      board: mockBoardFor(personaId),
      constellation: MOCK_CONSTELLATION,
      glossary: GLOSSARY,
      loading: false,
      error: null,
    };
  }
  // Live: fall back to mocks until the fetch resolves (no empty flash).
  return {
    packs: live?.packs ?? PERSONAS,
    board: live?.board ?? mockBoardFor(personaId),
    constellation: live?.constellation ?? MOCK_CONSTELLATION,
    glossary: live?.glossary ?? GLOSSARY,
    loading: live === null && error === null,
    error,
  };
}

/** Writing-canvas review — live vision check when on, a benign mock otherwise. */
export async function checkWriting(image: string, lessonId?: string): Promise<WritingCheckResult> {
  if (CLASSROOM_LIVE) return postWritingCheck(image, lessonId);
  return { feedback: "Nicely formed — that's the idea.", annotation: null, score: null };
}
