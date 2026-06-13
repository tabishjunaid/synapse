"use client";

import { useCallback, useEffect, useState } from "react";

import { getCourse } from "./api";
import type { CourseView } from "./types";

/** Loads the learner's current course (or null → needs onboarding). */
export function useCourse() {
  const [course, setCourse] = useState<CourseView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { course } = await getCourse();
      setCourse(course);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { course, loading, error, refresh, setCourse };
}
