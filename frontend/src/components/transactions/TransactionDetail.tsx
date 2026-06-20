import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPencil, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { amountClass, effectiveDate, fmtAmount, fmtDate, statusLabel } from "../../lib/format";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP, type MainCategory, type SubCategory } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";
import { getAccounts, type Account, type Transaction } from "../../lib/store";

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
  onOpenCategoryPicker?: (t: Transaction) => void;
  onIsExtraordinaryChange?: (txId: string, value: boolean) => Promise<void>;
  onCustomDateChange?: (txId: string, date: string | undefined) => Promise<void>;
  onCommentChange?: (txId: string, comment: string | undefined) => Promise<void>;
  onDelete?: (txId: string) => Promise<void>;
}

const FULL_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export default function TransactionDetail({
  transaction: tx,
  onClose,
  onOpenCategoryPicker,
  onIsExtraordinaryChange,
  onCustomDateChange,
  onCommentChange,
  onDelete,
}: TransactionDetailProps) {
  const { t } = useTranslation(["transactions", "categories"]);
  const [account, setAccount] = useState<Account | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingComment, setEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(tx.comment ?? "");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void getAccounts().then((all) => setAccount(all.find((a) => a.uid === tx.accountUid)));
  }, [tx.accountUid]);
  const subCat = tx.categoryId != null ? SUB_CATEGORY_MAP[tx.categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;

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
            {account?.name && (
              <DetailRow label={t("transactions:detail.account")}>
                {account.name}{account.bban && ` (${account.bban})`}
              </DetailRow>
            )}

            <div className="flex items-center justify-between px-6 py-3 text-sm">
              <span className="text-muted text-xs shrink-0 mr-4">
                {effectiveDate(tx) === tx.bookingDate
                  ? t("transactions:detail.transactionBookingDate")
                  : t("transactions:detail.transactionDate")}
              </span>
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {tx.customDate ? (
                  <>
                    <span className="text-muted text-xs line-through">
                      {fmtDate(tx.transactionDate, FULL_DATE)}
                    </span>
                    <span className="text-text text-right">{fmtDate(tx.customDate, FULL_DATE)}</span>
                    {onCustomDateChange && (
                      <button
                        className="text-muted hover:text-text text-xs leading-none"
                        title={t("transactions:detail.resetDate")}
                        onClick={() => void onCustomDateChange(tx.id, undefined)}
                      >
                        ✕
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-text text-right">
                    {fmtDate(tx.transactionDate, FULL_DATE)}
                  </span>
                )}
                {onCustomDateChange && (
                  <>
                    <input
                      ref={dateInputRef}
                      type="date"
                      className="w-0 h-0 opacity-0 overflow-hidden flex-none border-0 p-0"
                      value={effectiveDate(tx) ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const naturalDate = tx.transactionDate;
                        void onCustomDateChange(tx.id, val === naturalDate ? undefined : val || undefined);
                      }}
                    />
                    <button
                      className="text-muted hover:text-text text-xs leading-none"
                      onClick={() => dateInputRef.current?.showPicker()}
                    >
                      <FontAwesomeIcon icon={faPencil} className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {effectiveDate(tx) !== tx.bookingDate && (
              <DetailRow label={t("transactions:detail.bookingDate")}>
                {fmtDate(tx.bookingDate, FULL_DATE)}
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

            {(onCommentChange || tx.comment) && (
              <div className="px-6 py-3">
                {editingComment ? (
                  <>
                    <span className="text-muted text-xs block mb-1.5">{t("transactions:detail.comment")}</span>
                    <div className="flex flex-col gap-2">
                      <textarea
                        ref={commentRef}
                        className="w-full text-sm text-text bg-surface-2 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                        rows={3}
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder={t("transactions:detail.commentPlaceholder")}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          className="text-xs text-muted hover:text-text flex items-center gap-1"
                          onClick={() => setEditingComment(false)}
                        >
                          <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                          {t("transactions:detail.commentCancel")}
                        </button>
                        <button
                          className="text-xs text-accent hover:opacity-80 flex items-center gap-1 font-medium"
                          onClick={async () => {
                            await onCommentChange!(tx.id, commentDraft || undefined);
                            setEditingComment(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                          {t("transactions:detail.commentSave")}
                        </button>
                      </div>
                    </div>
                  </>
                ) : tx.comment ? (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-muted text-xs">{t("transactions:detail.comment")}</span>
                      {onCommentChange && (
                        <button
                          className="text-muted hover:text-text text-xs leading-none"
                          title={t("transactions:detail.editComment")}
                          onClick={() => {
                            setCommentDraft(tx.comment ?? "");
                            setEditingComment(true);
                            setTimeout(() => commentRef.current?.focus(), 0);
                          }}
                        >
                          <FontAwesomeIcon icon={faPencil} className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-text whitespace-pre-wrap">{tx.comment}</p>
                  </>
                ) : onCommentChange ? (
                  <button
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border text-muted hover:text-text hover:border-text/30 transition-colors"
                    onClick={() => {
                      setCommentDraft("");
                      setEditingComment(true);
                      setTimeout(() => commentRef.current?.focus(), 0);
                    }}
                  >
                    <FontAwesomeIcon icon={faPencil} className="w-3 h-3" />
                    {t("transactions:detail.addComment")}
                  </button>
                ) : null}
              </div>
            )}
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

        {(onIsExtraordinaryChange || onDelete) && (
          <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between">
            {onDelete ? (
              <button
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                onClick={() => setConfirmingDelete(true)}
              >
                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                {t("transactions:detail.deleteTransaction")}
              </button>
            ) : (
              <span />
            )}
            {onIsExtraordinaryChange && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-muted">{t("transactions:detail.hideFromStats")}</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                  checked={tx.isExtraordinary}
                  onChange={(e) => void onIsExtraordinaryChange(tx.id, e.target.checked)}
                />
              </label>
            )}
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmingDelete(false);
          }}
        >
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm mx-4 shadow-xl p-6 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-text">{t("transactions:detail.deleteConfirmTitle")}</h2>
            <p className="text-xs text-muted leading-relaxed">{t("transactions:detail.deleteConfirmBody")}</p>
            <div className="flex gap-2 justify-end">
              <button
                className="btn-ghost text-sm px-4 py-1.5"
                onClick={() => setConfirmingDelete(false)}
              >
                {t("transactions:detail.deleteConfirmCancel")}
              </button>
              <button
                className="text-sm px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                onClick={() => {
                  setConfirmingDelete(false);
                  void onDelete!(tx.id).then(() => onClose());
                }}
              >
                {t("transactions:detail.deleteConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
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
