// Knowledge-pack personas. In the real product these come from each pack's
// `persona.yaml` (concept doc §"Design-token layer" / §"Knowledge Packs"): a
// token override set (accent, display font, density, direction) plus voice and
// name. Swapping the pack re-skins the whole classroom. Mocked here for the
// UI build; the shape mirrors what the backend will eventually serve.

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

export const PERSONAS: Persona[] = [
  {
    id: "calculus",
    name: "Dr. Ada Lin",
    subject: "Calculus",
    glyph: "∫",
    accent: "#6aa9ff",
    accent2: "#9b8cff",
    glow: "106, 169, 255",
    fontDisplay: "var(--font-geist-sans), system-ui, sans-serif",
    dir: "ltr",
    density: "comfortable",
    greeting: "Good to see you again.",
    openingLine:
      "Last time we found the slope of a curve at a point. Today: what the derivative really measures.",
    voiceHint: "warm, measured",
    sttTier: "on-device",
    ttsTier: "local",
  },
  {
    id: "physics",
    name: "Prof. Cosmo Reyes",
    subject: "Physics",
    glyph: "✦",
    accent: "#ffb454",
    accent2: "#ff7a8a",
    glow: "255, 180, 84",
    fontDisplay: "var(--font-geist-sans), system-ui, sans-serif",
    dir: "ltr",
    density: "comfortable",
    greeting: "Ready to break some intuitions?",
    openingLine:
      "A feather and a hammer hit the ground together on the Moon. Let's see why gravity doesn't care about mass.",
    voiceHint: "bright, energetic",
    sttTier: "on-device",
    ttsTier: "local",
  },
  {
    id: "arabic",
    name: "الأستاذة ليلى",
    subject: "Arabic · العربية",
    glyph: "ع",
    accent: "#34d2a6",
    accent2: "#5ad1ff",
    glow: "52, 210, 166",
    fontDisplay: "'Noto Naskh Arabic', 'Geeza Pro', 'Amiri', var(--font-geist-sans), serif",
    dir: "rtl",
    density: "comfortable",
    greeting: "أهلًا بك مجددًا.",
    openingLine: "اليوم نتعلّم كيف تتصل الحروف في الكلمة. ابدئي بالاستماع.",
    voiceHint: "calm, clear",
    sttTier: "server",
    ttsTier: "cloud",
  },
  {
    id: "music",
    name: "Mr. Theo Vance",
    subject: "Music Theory",
    glyph: "♪",
    accent: "#f48fb1",
    accent2: "#b794f6",
    glow: "244, 143, 177",
    fontDisplay: "var(--font-geist-sans), system-ui, sans-serif",
    dir: "ltr",
    density: "compact",
    greeting: "Let's tune your ear.",
    openingLine:
      "A major scale is just a pattern of steps. Once you hear the pattern, you can find it anywhere.",
    voiceHint: "playful, precise",
    sttTier: "on-device",
    ttsTier: "local",
  },
];

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
