import { amountClass, fmtAmount, fmtDate } from "../../lib/format";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import type { Transaction } from "../../lib/store";
import CategoryBadge from "./CategoryBadge";

type TransactionRowProps = {
  transaction: Transaction;
  onClick: () => void;
  onCategoryClick?: () => void;
};

export default function TransactionRow({ transaction: t, onClick, onCategoryClick }: TransactionRowProps) {
  const subCat = t.categoryId != null ? SUB_CATEGORY_MAP[t.categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;

  return (
    <div
      className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <CategoryBadge
          categoryId={t.categoryId}
          onClick={onCategoryClick}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${t.status === "PNDG" ? "italic text-muted" : "text-text"}`}>
          {t.description || "—"}
          {t.status === "PNDG" ? " (Reservert)" : ""}
        </div>
        {subCat && mainCat ? (
          <div className="text-[11px] mt-0.5 truncate" style={{ color: mainCat.color }}>
            {subCat.name}
          </div>
        ) : (
          <div className="text-[11px] text-muted mt-0.5">Ukategorisert</div>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0">
        <div className={`mono text-sm font-medium tabular-nums ${amountClass(t)}`}>
          {t.amount >= 0 ? "+" : ""}
          {fmtAmount(t.amount, t.currency)}
        </div>
        <div className="text-xs text-muted mt-0.5">
          {fmtDate(t.bookingDate ?? t.transactionDate)}
        </div>
      </div>
    </div>
  );
}
