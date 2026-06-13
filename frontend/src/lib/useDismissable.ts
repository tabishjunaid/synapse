"use client";

// Closes a popover/menu when the user presses Escape or clicks/taps outside it.
// Attach the returned ref to the popover's outermost element (the trigger +
// panel wrapper). Pairs with aria-expanded on the trigger for screen readers.

import { useEffect, useRef } from "react";

export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Capture phase so we see the event even if inner handlers stop propagation.
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, onClose]);

  return ref;
}
