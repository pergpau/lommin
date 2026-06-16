import { amountClass, fmtAmount, fmtDate, statusLabel } from "../../lib/format";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP, type MainCategory, type SubCategory } from "../../lib/categories";
import type { Transaction } from "../../lib/store";

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
  onOpenCategoryPicker?: (t: Transaction) => void;
}

const FULL_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export default function TransactionDetail({
  transaction: t,
  onClose,
  onOpenCategoryPicker,
}: TransactionDetailProps) {
  const subCat = t.categoryId != null ? SUB_CATEGORY_MAP[t.categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;
  const showTransactionDate =
    t.transactionDate && t.transactionDate !== t.bookingDate;

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
          <span className="font-semibold text-text text-sm">Transaksjon</span>
          <button className="text-muted hover:text-text text-lg leading-none" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Hero amount */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className={`mono text-3xl font-semibold tabular-nums ${amountClass(t)}`}>
              {t.amount >= 0 ? "+" : ""}
              {fmtAmount(t.amount, t.currency)}
            </div>
            {t.status === "PNDG" && (
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                {statusLabel(t.status)}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="px-6 pb-4">
            <div className="text-xs text-muted mb-1">Beskrivelse</div>
            <div className="text-sm text-text">{t.description || "—"}</div>
          </div>

          {/* Details list */}
          <div className="border-t border-border divide-y divide-border mx-0">
            <DetailRow label="Bokføringsdato">
              {fmtDate(t.bookingDate, FULL_DATE)}
            </DetailRow>

            {showTransactionDate && (
              <DetailRow label="Transaksjonsdato">
                {fmtDate(t.transactionDate, FULL_DATE)}
              </DetailRow>
            )}

            <div className="flex items-center justify-between px-6 py-3">
              <span className="text-muted text-xs shrink-0 mr-4">Kategori</span>
              <CategoryPill
                subCat={subCat}
                mainCat={mainCat}
                onClick={onOpenCategoryPicker ? () => onOpenCategoryPicker(t) : undefined}
              />
            </div>

            {t.bankTransactionCode && (
              <DetailRow label="Bankkode">{t.bankTransactionCode}</DetailRow>
            )}

            <DetailRow label="Referanse">
              <span className="mono text-xs">{t.entryReference}</span>
            </DetailRow>
          </div>

          {/* Raw data */}
          <div className="px-6 py-4">
            <details>
              <summary className="text-xs text-muted cursor-pointer select-none py-1">
                Rådata
              </summary>
              <pre className="text-xs text-muted bg-surface-2 rounded p-3 overflow-x-auto mt-2 whitespace-pre-wrap break-all">
                {JSON.stringify(t.raw, null, 2)}
              </pre>
            </details>
          </div>
        </div>
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
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border";
  const hoverClass = onClick ? " transition-opacity hover:opacity-70" : "";

  if (subCat && mainCat) {
    const style = {
      backgroundColor: mainCat.color + "22",
      borderColor: mainCat.color + "44",
      color: mainCat.color,
    };
    return onClick ? (
      <button className={base + hoverClass} style={style} onClick={onClick}>
        {subCat.icon} {subCat.name}
      </button>
    ) : (
      <span className={base} style={style}>
        {subCat.icon} {subCat.name}
      </span>
    );
  }

  return onClick ? (
    <button className={`${base} bg-surface-2 border-border text-muted${hoverClass}`} onClick={onClick}>
      Ukategorisert
    </button>
  ) : (
    <span className={`${base} bg-surface-2 border-border text-muted`}>Ukategorisert</span>
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
