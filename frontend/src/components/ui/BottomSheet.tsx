import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

interface BottomSheetProps {
  title: ReactNode;
  /** Called after the exit animation finishes (✕, backdrop click, Escape). */
  onClose: () => void;
  /** Panel sizing (widths/heights); replaces the default entirely. */
  panelClassName?: string;
  titleClassName?: string;
  /** Exposes the panel element, e.g. for drag-to-dismiss gestures. */
  sheetRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

export default function BottomSheet({
  title,
  onClose,
  panelClassName = "sm:max-w-md max-h-[85vh]",
  titleClassName = "text-accent",
  sheetRef,
  children,
}: BottomSheetProps) {
  const [closing, setClosing] = useState(false);
  // A running or fill-mode animation overrides inline `style.transform`, so the
  // entrance class must be gone before drag handlers can move the sheet.
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const dismiss = () => setClosing(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Native listener: drag handlers on the panel may stopPropagation, which
  // would keep a delegated React handler from ever firing.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const onTouchStart = () => setEntered(true);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => el.removeEventListener("touchstart", onTouchStart);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) dismiss();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
      onAnimationEnd={() => {
        if (closing) onClose();
      }}
    >
      <div
        ref={(el) => {
          panelRef.current = el;
          if (sheetRef) sheetRef.current = el;
        }}
        className={`bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full flex flex-col shadow-xl ${panelClassName} ${closing ? "animate-sheet-out" : entered ? "" : "animate-sheet-in"}`}
        role="dialog"
        aria-modal="true"
        onAnimationEnd={(e) => {
          if (e.animationName === "sheetIn") setEntered(true);
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className={`font-semibold text-sm ${titleClassName}`}>{title}</span>
          <button className="text-muted hover:text-text text-lg leading-none" onClick={dismiss}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
