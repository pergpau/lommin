import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { TINT } from "../../lib/categories";
import { fmtAmount } from "../../lib/format";
import CategoryChip from "../transactions/CategoryChip";

type CategoryRowProps = {
  icon: IconDefinition;
  /** Drives both the chip color and the row's background tint. */
  color: string;
  name: string;
  amount: number;
  /** Omitted renders a blank percent cell; the column keeps its width. */
  pct?: number;
  /** Summary row above a list: no percent cell, no hover, not clickable. */
  header?: boolean;
  chipSize?: "sm";
  onClick?: () => void;
  className?: string;
};

export default function CategoryRow({
  icon,
  color,
  name,
  amount,
  pct,
  header,
  chipSize,
  onClick,
  className,
}: CategoryRowProps) {
  const tint = color + TINT.row;
  const body = (
    <>
      <CategoryChip icon={icon} color={color} size={chipSize} />
      <span
        className={
          header ? "text-sm font-medium text-text flex-1" : "text-sm text-text flex-1 truncate"
        }
      >
        {name}
      </span>
      {!header && (
        <span className="text-xs text-muted tabular-nums mono shrink-0 w-10 text-right">
          {pct != null ? `${pct.toFixed(0)}%` : ""}
        </span>
      )}
      <span
        className={`text-sm font-medium text-text tabular-nums mono${header ? "" : " shrink-0 text-right w-28"}`}
      >
        {fmtAmount(amount, undefined, 0)} kr
      </span>
    </>
  );

  if (header) {
    return (
      <div
        className={`px-4 py-3 flex items-center gap-2 ${className ?? ""}`}
        style={{ backgroundColor: tint }}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left ${className ?? ""}`}
      style={{ backgroundColor: tint }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = color + TINT.rowHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = tint)}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
