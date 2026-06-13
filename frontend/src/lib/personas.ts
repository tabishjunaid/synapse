// Knowledge-pack persona type + theming helper. The persona DATA is served live
// by the backend (`GET /api/knowledge-packs`, from `packs.py`); this file only
// holds the shape and the token→CSS mapping. Swapping a pack re-skins the room.

import type { CSSProperties } from "react";

export interface Persona {
  id: string;
  /** Teacher name, as the learner sees it. */
  name: string;
  subject: string;
  /** Lightweight avatar glyph until pack `assets/` provide real portraits. */
  glyph: string;
  accent: string;
  accent2: string;
  /** rgb triplet (space-separated) for rgba() glows. */
  glow: string;
  fontDisplay: string;
  dir: "ltr" | "rtl";
  density: "comfortable" | "compact";
  greeting: string;
  /** What the teacher is mid-lesson on — seeds the first caption. */
  openingLine: string;
  voiceHint: string;
  sttTier: "on-device" | "server";
  ttsTier: "local" | "cloud";
}

/** CSS custom properties applied to `.stage` to theme everything below it. */
export function personaVars(p: Persona): CSSProperties {
  return {
    "--accent": p.accent,
    "--accent-2": p.accent2,
    "--glow": p.glow,
    "--font-display": p.fontDisplay,
    "--pad": p.density === "compact" ? "1.15rem" : "1.5rem",
  } as CSSProperties;
}
