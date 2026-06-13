"use client";

// Tracks the user's `prefers-reduced-motion` setting reactively. CSS keyframes are
// handled by the global media query in globals.css; this hook is for JS-driven
// motion (requestAnimationFrame loops, imperative transforms) that CSS can't reach.
//
// Implemented with useSyncExternalStore so the matchMedia subscription is the source
// of truth — no setState-in-effect, correct SSR snapshot (false on the server).

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
