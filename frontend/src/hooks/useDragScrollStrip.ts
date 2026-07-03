import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type StripScrollView = {
  /** Index of the first item at least partially in view. */
  first: number;
  /** Index of the last item at least partially in view. */
  last: number;
  atStart: boolean;
  atEnd: boolean;
};

type Options = {
  /** Re-anchor the strip to its end whenever this value changes. */
  anchorKey?: unknown;
  /** Width reserved at the strip edges; arrow paging steps by clientWidth - peekPx. */
  peekPx?: number;
};

/**
 * Horizontal scroll strip with mouse drag-to-scroll and fling momentum.
 * Touch scrolling is left to the browser. Tracks which items are in view
 * (assumes equal-width items) and fades the edges that have more content.
 * Spread `stripProps` onto the scroll container.
 */
export function useDragScrollStrip(itemCount: number, { anchorKey, peekPx = 0 }: Options = {}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const momentumRef = useRef(0);
  const dragState = useRef({
    active: false,
    dragged: false,
    startX: 0,
    startScroll: 0,
    lastX: 0,
    lastT: 0,
    v: 0,
  });
  const [scrollView, setScrollView] = useState<StripScrollView>({
    first: 0,
    last: 0,
    atStart: true,
    atEnd: true,
  });

  const updateScrollView = useCallback(() => {
    const el = stripRef.current;
    if (!el || itemCount === 0) return;
    const unit = el.scrollWidth / itemCount;
    const first = Math.max(0, Math.floor(el.scrollLeft / unit));
    const last = Math.min(itemCount - 1, Math.ceil((el.scrollLeft + el.clientWidth) / unit) - 1);
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setScrollView((p) =>
      p.first === first && p.last === last && p.atStart === atStart && p.atEnd === atEnd
        ? p
        : { first, last, atStart, atEnd },
    );
  }, [itemCount]);

  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      updateScrollView();
    });
  };

  const stopMomentum = () => {
    if (momentumRef.current) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = 0;
    }
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(momentumRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    updateScrollView();
  }, [anchorKey, itemCount, updateScrollView]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    stopMomentum();
    const el = stripRef.current;
    if (!el) return;
    dragState.current = {
      active: true,
      dragged: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      lastX: e.clientX,
      lastT: performance.now(),
      v: 0,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    const el = stripRef.current;
    if (!s.active || !el) return;
    const dx = e.clientX - s.startX;
    if (!s.dragged && Math.abs(dx) > 4) {
      s.dragged = true;
      // Capture only once it's a real drag — capturing on pointerdown would
      // retarget the click to the strip and break tap-to-select on children.
      el.setPointerCapture(e.pointerId);
    }
    if (!s.dragged) return;
    el.scrollLeft = s.startScroll - dx;
    const now = performance.now();
    const dt = now - s.lastT;
    if (dt > 0) {
      s.v = (s.lastX - e.clientX) / dt;
      s.lastX = e.clientX;
      s.lastT = now;
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s.active) return;
    s.active = false;
    const el = stripRef.current;
    if (!el) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!s.dragged || Math.abs(s.v) < 0.05) return;
    let v = s.v;
    let last = performance.now();
    const step = (now: number) => {
      const strip = stripRef.current;
      if (!strip) return;
      const dt = now - last;
      last = now;
      strip.scrollLeft += v * dt;
      v *= Math.exp(-dt / 325);
      const atEdge =
        strip.scrollLeft <= 0 || strip.scrollLeft + strip.clientWidth >= strip.scrollWidth;
      momentumRef.current = Math.abs(v) > 0.02 && !atEdge ? requestAnimationFrame(step) : 0;
    };
    momentumRef.current = requestAnimationFrame(step);
  };

  const onPointerCancel = () => {
    dragState.current.active = false;
    dragState.current.dragged = false;
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (dragState.current.dragged) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.dragged = false;
    }
  };

  const scrollByPage = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    stopMomentum();
    el.scrollBy({ left: dir * (el.clientWidth - peekPx), behavior: "smooth" });
  };

  // Fade the edges that have more content beyond them.
  const stripMask = `linear-gradient(to right, ${scrollView.atStart ? "black" : "transparent"}, black 24px, black calc(100% - 24px), ${scrollView.atEnd ? "black" : "transparent"})`;

  const stripProps = {
    ref: stripRef,
    onScroll,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
    style: { maskImage: stripMask, WebkitMaskImage: stripMask } as CSSProperties,
  };

  return { scrollView, scrollByPage, stripProps };
}
