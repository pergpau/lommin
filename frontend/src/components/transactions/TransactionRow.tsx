import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import type { Transaction } from "../../lib/data";
import { amountClass, effectiveDate, fmtAmount, fmtDate } from "../../lib/format";
import CategoryBadge from "./CategoryBadge";

type TransactionRowProps = {
  transaction: Transaction;
  onClick: () => void;
  onCategoryClick?: () => void;
  ownershipShare?: number;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
};

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

type RowBadgeTone = "warning" | "yellow";

const ROW_BADGE_TONE: Record<RowBadgeTone, string> = {
  warning: "text-warning border-warning/20",
  yellow: "text-yellow-600 border-yellow-400/30",
};

function RowBadge({ tone, children }: { tone: RowBadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none tabular-nums ${ROW_BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export default function TransactionRow({
  transaction: tx,
  onClick,
  onCategoryClick,
  ownershipShare,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onLongPress,
}: TransactionRowProps) {
  const { t } = useTranslation(["transactions", "common"]);
  const subCat = tx.categoryId != null ? SUB_CATEGORY_MAP[tx.categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;
  const sharePct = ownershipShare != null ? Math.round(ownershipShare * 100) : undefined;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (selectMode || !onLongPress) return;
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onLongPress?.();
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!startPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - startPos.current.x);
    const dy = Math.abs(touch.clientY - startPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearLongPress();
  }

  function handleActivate() {
    // Swallow the click that fires right after a long-press.
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (selectMode) onToggleSelect?.();
    else onClick();
  }

  return (
    <div
      className={`relative px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
        selected ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-surface-2"
      }`}
      onClick={handleActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleActivate();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      {sharePct != null && (
        <div className="absolute inset-y-0 left-0 w-[3px] bg-warning/50 rounded-l" />
      )}
      {selectMode ? (
        <CategoryBadge categoryId={tx.categoryId} />
      ) : (
        <div onClick={(e) => e.stopPropagation()}>
          <CategoryBadge categoryId={tx.categoryId} onClick={onCategoryClick} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm flex items-center gap-1.5 ${tx.status === "PNDG" ? "italic text-muted" : "text-text"}`}
        >
          <span className="truncate">
            {tx.description || "—"}
            {tx.status === "PNDG" ? " " + t("row.pending") : ""}
          </span>
          {sharePct != null && <RowBadge tone="warning">{sharePct}%</RowBadge>}
          {tx.excludeFromCalculations && <RowBadge tone="yellow">Ekskludert</RowBadge>}
        </div>
        {subCat && mainCat ? (
          <div
            className="text-[11px] mt-0.5 truncate h-4 flex items-center"
            style={{ color: mainCat.color }}
          >
            {t("categories:sub." + subCat.id)}
          </div>
        ) : (
          <div className="mt-0.5 h-4 flex items-center">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-400/12 text-orange-500 border border-orange-400/35 leading-none dark:text-orange-400">
              {t("row.uncategorized")}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className={`mono text-sm font-medium tabular-nums ${amountClass(tx)}`}>
          {tx.amount >= 0 ? "+" : ""}
          {fmtAmount(tx.amount, tx.currency)}
        </span>
        <div className="text-xs text-muted mt-0.5">{fmtDate(effectiveDate(tx))}</div>
      </div>
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="shrink-0 w-5 h-5 accent-accent pointer-events-none"
        />
      )}
    </div>
  );
}
