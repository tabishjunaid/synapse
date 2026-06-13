import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "border-border text-foreground",
  accent: "border-accent/30 text-accent",
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  muted: "border-border text-muted-foreground",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
