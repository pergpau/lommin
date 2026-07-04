import { useTranslation } from "react-i18next";
import { amountClass, effectiveDate, fmtAmount, fmtDate } from "../../lib/format";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import type { Transaction } from "../../lib/data";
import CategoryBadge from "./CategoryBadge";

type TransactionRowProps = {
  transaction: Transaction;
  onClick: () => void;
  onCategoryClick?: () => void;
  ownershipShare?: number;
};

export default function TransactionRow({
  transaction: tx,
  onClick,
  onCategoryClick,
  ownershipShare,
}: TransactionRowProps) {
  const { t } = useTranslation(["transactions", "common"]);
  const subCat = tx.categoryId != null ? SUB_CATEGORY_MAP[tx.categoryId] : undefined;
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
        <CategoryBadge categoryId={tx.categoryId} onClick={onCategoryClick} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm flex items-center gap-1.5 ${tx.status === "PNDG" ? "italic text-muted" : "text-text"}`}
        >
          <span className="truncate">
            {tx.description || "—"}
            {tx.status === "PNDG" ? " " + t("row.pending") : ""}
          </span>
          {tx.excludeFromCalculations && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-600 border border-yellow-400/30 leading-none">
              Ekskludert
            </span>
          )}
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
        <div className="flex items-center gap-1.5">
          {ownershipShare != null && (
            <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 leading-none tabular-nums">
              {t("common:shared", { pct: Math.round(ownershipShare * 100) })}
            </span>
          )}
          <span className={`mono text-sm font-medium tabular-nums ${amountClass(tx)}`}>
            {tx.amount >= 0 ? "+" : ""}
            {fmtAmount(tx.amount, tx.currency)}
          </span>
        </div>
        <div className="text-xs text-muted mt-0.5">{fmtDate(effectiveDate(tx))}</div>
      </div>
    </div>
  );
}
