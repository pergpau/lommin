import { useEffect, useRef } from "react";

type SwipeDirection = "left" | "right";

interface UseSwipeOptions {
  onSwipe: (direction: SwipeDirection) => void;
  minDistance?: number;
  edgeZone?: number;
  angleRatio?: number;
}

export function useSwipe<T extends HTMLElement>({
  onSwipe,
  minDistance = 50,
  edgeZone = 30,
  angleRatio = 1.5,
}: UseSwipeOptions) {
  const ref = useRef<T | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isEdge = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      isEdge.current =
        touch.clientX < edgeZone ||
        touch.clientX > window.innerWidth - edgeZone;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isEdge.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;
      if (Math.abs(dx) >= minDistance && Math.abs(dx) > Math.abs(dy) * angleRatio) {
        onSwipe(dx < 0 ? "left" : "right");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onSwipe, minDistance, edgeZone, angleRatio]);

  return ref;
}
