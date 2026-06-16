import { amountClass, fmtAmount, fmtDate } from "../../lib/format";
import type { Transaction } from "../../lib/store";
import CategoryBadge from "./CategoryBadge";

type TransactionRowProps = {
  transaction: Transaction;
  onClick: () => void;
  onCategoryClick?: () => void;
};

export default function TransactionRow({ transaction: t, onClick, onCategoryClick }: TransactionRowProps) {
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
        <div className="text-xs text-muted mt-0.5">
          {fmtDate(t.bookingDate ?? t.transactionDate)}
        </div>
      </div>
      <div className={`mono text-sm font-medium tabular-nums ${amountClass(t)}`}>
        {t.amount >= 0 ? "+" : ""}
        {fmtAmount(t.amount, t.currency)}
      </div>
    </div>
  );
}
