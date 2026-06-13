"use client";

// Live classroom data — no mocks. Packs come from the backend pack catalog;
// per-lesson artifacts (board, glossary, constellation) come from the lesson the
// classroom is bound to. Without a lessonId there are no per-lesson artifacts.

import { useEffect, useState } from "react";

import {
  getBoard,
  getConstellation,
  getGlossary,
  getKnowledgePacks,
  postWritingCheck,
} from "./api";
import type { BoardContent } from "./classroomMock";
import type { Persona } from "./personas";
import type { ConstellationData, WritingCheckResult } from "./types";

const EMPTY_CONSTELLATION: ConstellationData = { skills: [], edges: [] };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface ClassroomData {
  packs: Persona[];
  board: BoardContent | null;
  constellation: ConstellationData;
  glossary: Record<string, string>;
  loading: boolean;
  error: string | null;
}

/** Live classroom data. Packs load always; board/glossary/constellation load
 *  for the bound lesson (none without a lessonId). */
export function useClassroomData(lessonId?: string): ClassroomData {
  const [packs, setPacks] = useState<Persona[]>([]);
  const [board, setBoard] = useState<BoardContent | null>(null);
  const [constellation, setConstellation] = useState<ConstellationData>(EMPTY_CONSTELLATION);
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  // Which lesson the loaded artifacts belong to — lets us derive loading/readiness
  // without setting state synchronously in the effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getKnowledgePacks()
      .then((p) => !cancelled && setPacks(p))
      .catch((e) => !cancelled && setError(msg(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    Promise.all([getBoard(lessonId), getConstellation(lessonId), getGlossary(lessonId)])
      .then(([b, c, g]) => {
        if (cancelled) return;
        setBoard(b);
        setConstellation(c);
        setGlossary(g);
        setLoadedKey(lessonId);
      })
      .catch((e) => !cancelled && setError(msg(e)));
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const ready = !!lessonId && loadedKey === lessonId;
  return {
    packs,
    board: ready ? board : null,
    constellation: ready ? constellation : EMPTY_CONSTELLATION,
    glossary: ready ? glossary : {},
    loading: !!lessonId && !ready,
    error,
  };
}

/** Writing-canvas review — always the live vision check (degrades server-side
 *  to a graceful message when no vision model is configured). */
export async function checkWriting(image: string, lessonId?: string): Promise<WritingCheckResult> {
  return postWritingCheck(image, lessonId);
}
