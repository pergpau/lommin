import type { ReactNode } from "react";

type ModalActionsProps = {
  /** Left-aligned secondary action (delete, "remove category"); pushes the rest right. */
  leading?: ReactNode;
  /** Footer of a scrolling panel: top border, pinned. Padding comes from `className`. */
  bordered?: boolean;
  className?: string;
  children: ReactNode;
};

/** The cancel/confirm row at the bottom of a modal or bottom sheet. */
export default function ModalActions({
  leading,
  bordered,
  className,
  children,
}: ModalActionsProps) {
  const frame = bordered ? "border-t border-border shrink-0" : "";
  if (leading !== undefined) {
    return (
      <div className={`flex items-center justify-between ${frame} ${className ?? ""}`}>
        {leading}
        <div className="flex items-center gap-2">{children}</div>
      </div>
    );
  }
  return <div className={`flex gap-2 justify-end ${frame} ${className ?? ""}`}>{children}</div>;
}
