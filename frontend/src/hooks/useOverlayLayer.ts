import { useEffect, useRef } from "react";

// Shared across all mounted BottomSheet/Modal instances so stacked overlays
// nest correctly: body scroll is locked once (ref-counted, not per-instance
// save/restore) and Escape only dismisses the topmost layer.
let stack: symbol[] = [];
let lockCount = 0;
let prevBodyOverflow = "";

export function useOverlayLayer(onEscape: () => void) {
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol();
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const id = idRef.current!;
    stack.push(id);
    if (lockCount === 0) prevBodyOverflow = document.body.style.overflow;
    lockCount++;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack[stack.length - 1] === id) onEscapeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack = stack.filter((s) => s !== id);
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = prevBodyOverflow;
    };
  }, []);
}
