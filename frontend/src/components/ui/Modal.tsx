import type { ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  title?: string;
  /** Renders above bottom sheets: higher z-index, darker blurred backdrop. */
  elevated?: boolean;
  /** Ignore backdrop clicks, e.g. while an operation is running. */
  closeDisabled?: boolean;
  /** Panel sizing/padding/layout; replaces the default entirely. */
  panelClassName?: string;
  children: ReactNode;
}

export default function Modal({
  onClose,
  title,
  elevated = false,
  closeDisabled = false,
  panelClassName = "max-w-sm p-6",
  children,
}: ModalProps) {
  return (
    <div
      className={
        elevated
          ? "fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      }
      onClick={(e) => {
        if (!closeDisabled && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-surface border border-border w-full mx-4 ${
          elevated ? "rounded-2xl shadow-xl" : "rounded-xl shadow-lg"
        } ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
