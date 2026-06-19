import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { amountClass, fmtAmount, fmtDate, statusLabel } from "../../lib/format";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP, type MainCategory, type SubCategory } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";
import type { Transaction } from "../../lib/store";

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
  onOpenCategoryPicker?: (t: Transaction) => void;
  onIsExtraordinaryChange?: (txId: string, value: boolean) => Promise<void>;
}

const FULL_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export default function TransactionDetail({
  transaction: tx,
  onClose,
  onOpenCategoryPicker,
  onIsExtraordinaryChange,
}: TransactionDetailProps) {
  const { t } = useTranslation(["transactions", "categories"]);
  const subCat = tx.categoryId != null ? SUB_CATEGORY_MAP[tx.categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;
  const showTransactionDate =
    tx.transactionDate && tx.transactionDate !== tx.bookingDate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-text text-sm">{t("transactions:detail.title")}</span>
          <button className="text-muted hover:text-text text-lg leading-none" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Hero amount */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className={`mono text-3xl font-semibold tabular-nums ${amountClass(tx)}`}>
              {tx.amount >= 0 ? "+" : ""}
              {fmtAmount(tx.amount, tx.currency)}
            </div>
            {tx.status === "PNDG" && (
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                {statusLabel(tx.status)}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="px-6 pb-4">
            <div className="text-xs text-muted mb-1">{t("transactions:detail.description")}</div>
            <div className="text-sm text-text">{tx.description || "—"}</div>
          </div>

          {/* Details list */}
          <div className="border-t border-border divide-y divide-border mx-0">
            <DetailRow label={t("transactions:detail.bookingDate")}>
              {fmtDate(tx.bookingDate, FULL_DATE)}
            </DetailRow>

            {showTransactionDate && (
              <DetailRow label={t("transactions:detail.transactionDate")}>
                {fmtDate(tx.transactionDate, FULL_DATE)}
              </DetailRow>
            )}

            <div className="flex items-center justify-between px-6 py-3">
              <span className="text-muted text-xs shrink-0 mr-4">{t("transactions:detail.category")}</span>
              <CategoryPill
                subCat={subCat}
                mainCat={mainCat}
                onClick={onOpenCategoryPicker ? () => onOpenCategoryPicker(tx) : undefined}
              />
            </div>

            {tx.bankTransactionCode && (
              <DetailRow label={t("transactions:detail.bankCode")}>{tx.bankTransactionCode}</DetailRow>
            )}

            <DetailRow label={t("transactions:detail.reference")}>
              <span className="mono text-xs">{tx.entryReference}</span>
            </DetailRow>
          </div>

          {/* Raw data */}
          <div className="px-6 py-4">
            <details>
              <summary className="text-xs text-muted cursor-pointer select-none py-1">
                {t("transactions:detail.rawData")}
              </summary>
              <pre className="text-xs text-muted bg-surface-2 rounded p-3 overflow-x-auto mt-2 whitespace-pre-wrap break-all">
                {JSON.stringify(tx.raw, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        {onIsExtraordinaryChange && (
          <div className="px-4 py-3 border-t border-border shrink-0 flex justify-end">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-muted">{t("transactions:detail.hideFromStats")}</span>
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-accent cursor-pointer"
                checked={tx.isExtraordinary}
                onChange={(e) => void onIsExtraordinaryChange(tx.id, e.target.checked)}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryPill({
  subCat,
  mainCat,
  onClick,
}: {
  subCat?: SubCategory;
  mainCat?: MainCategory;
  onClick?: () => void;
}) {
  const { t } = useTranslation(["transactions", "categories"]);
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border";
  const hoverClass = onClick ? " transition-opacity hover:opacity-70" : "";

  if (subCat && mainCat) {
    const style = {
      backgroundColor: mainCat.color + "22",
      borderColor: mainCat.color + "44",
      color: mainCat.color,
    };
    const label = t("categories:sub." + subCat.id);
    return onClick ? (
      <button className={base + hoverClass} style={style} onClick={onClick}>
        <FontAwesomeIcon icon={getCategoryIcon(subCat.id)} className="w-3 h-3" /> {label}
      </button>
    ) : (
      <span className={base} style={style}>
        <FontAwesomeIcon icon={getCategoryIcon(subCat.id)} className="w-3 h-3" /> {label}
      </span>
    );
  }

  const uncategorized = t("categories:uncategorized");
  return onClick ? (
    <button className={`${base} bg-surface-2 border-border text-muted${hoverClass}`} onClick={onClick}>
      {uncategorized}
    </button>
  ) : (
    <span className={`${base} bg-surface-2 border-border text-muted`}>{uncategorized}</span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-3 text-sm">
      <span className="text-muted text-xs shrink-0 mr-4">{label}</span>
      <span className="text-text text-right">{children}</span>
    </div>
  );
}
