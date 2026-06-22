import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTrash } from "@fortawesome/free-solid-svg-icons";
import Button from "../ui/Button";
import DeleteConfirmModal from "../ui/DeleteConfirmModal";
import { amountClass, effectiveDate, fmtAmount, fmtDate } from "../../lib/format";
import { SUB_CATEGORY_MAP } from "../../lib/categories";
import { pairKey } from "../../lib/duplicates";
import type { Transaction } from "../../lib/store";
import CategoryBadge from "./CategoryBadge";
import CategoryPicker from "./CategoryPicker";
import TransactionDetail from "./TransactionDetail";

interface DuplicatesListProps {
  pairs: [Transaction, Transaction][];
  onCategoryChange: (txId: string, categoryId: number | undefined) => Promise<void>;
  onDelete: (txId: string) => Promise<void>;
  onDismissPair: (key: string) => Promise<void>;
  onMutated?: () => void;
}

export default function DuplicatesList({
  pairs,
  onCategoryChange,
  onDelete,
  onDismissPair,
  onMutated,
}: DuplicatesListProps) {
  const { t } = useTranslation("dashboard");
  const [pickerFor, setPickerFor] = useState<Transaction | null>(null);
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const allTxs = pairs.flatMap(([a, b]) => [a, b]);
  const detailFor = detailForId ? (allTxs.find((tx) => tx.id === detailForId) ?? null) : null;
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [dismissingKeys, setDismissingKeys] = useState<Set<string>>(new Set());

  function handleDismiss(key: string) {
    setDismissingKeys((prev) => new Set([...prev, key]));
    setTimeout(() => void onDismissPair(key), 750);
  }

  async function handleCategorySelect(categoryId: number | undefined) {
    if (!pickerFor) return;
    await onCategoryChange(pickerFor.id, categoryId);
    setPickerFor(null);
  }

  function isResolved(tx: Transaction): boolean {
    return tx.categoryId != null && SUB_CATEGORY_MAP[tx.categoryId]?.type === "exclude";
  }

  const sorted = [...pairs].sort(([a], [b]) =>
    effectiveDate(b) > effectiveDate(a) ? 1 : effectiveDate(b) < effectiveDate(a) ? -1 : 0
  );

  let lastYear: number | null = null;

  return (
    <>
      <div className="space-y-3">
        {sorted.map(([a, b], i) => {
          const year = new Date(effectiveDate(a)).getFullYear();
          const showYear = year !== lastYear;
          lastYear = year;
          return (
            <div key={i}>
              {showYear && (
                <div className="text-xs font-semibold text-muted uppercase tracking-wide px-1 pb-1 pt-2 first:pt-0">
                  {year}
                </div>
              )}
              <div className={`card overflow-hidden ${dismissingKeys.has(pairKey(a, b)) ? "opacity-0 transition-opacity duration-1000" : ""}`}>
                <DuplicateRow
                  tx={a}
                  resolved={isResolved(a)}
                  onCategoryClick={() => setPickerFor(a)}
                  onDelete={() => setDeletingTx(a)}
                  onTransactionClick={() => setDetailForId(a.id)}
                />
                <div className="border-t border-border" />
                <DuplicateRow
                  tx={b}
                  resolved={isResolved(b)}
                  onCategoryClick={() => setPickerFor(b)}
                  onDelete={() => setDeletingTx(b)}
                  onTransactionClick={() => setDetailForId(b.id)}
                />
                <div className="border-t border-border px-4 py-2 flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDismiss(pairKey(a, b))}
                  >
                    <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                    {t("duplicates.notDuplicate")}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pickerFor && (
        <CategoryPicker
          currentCategoryId={pickerFor.categoryId}
          onSelect={handleCategorySelect}
          onClose={() => setPickerFor(null)}
        />
      )}

      {detailFor && (
        <TransactionDetail
          transaction={detailFor}
          onClose={() => setDetailForId(null)}
          onOpenCategoryPicker={(tx) => { setDetailForId(null); setPickerFor(tx); }}
          onMutated={onMutated}
        />
      )}

      <DeleteConfirmModal
        open={!!deletingTx}
        onCancel={() => setDeletingTx(null)}
        onConfirm={() => {
          const id = deletingTx!.id;
          setDeletingTx(null);
          void onDelete(id);
        }}
      />
    </>
  );
}

interface DuplicateRowProps {
  tx: Transaction;
  resolved: boolean;
  onCategoryClick: () => void;
  onDelete: () => void;
  onTransactionClick: () => void;
}

function DuplicateRow({ tx, resolved, onCategoryClick, onDelete, onTransactionClick }: DuplicateRowProps) {
  const { t } = useTranslation("dashboard");
  return (
    <div
      className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-2 transition-colors ${resolved ? "opacity-40" : ""}`}
      onClick={onTransactionClick}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <CategoryBadge categoryId={tx.categoryId} onClick={onCategoryClick} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text truncate">{tx.description || "—"}</div>
        <div className="text-xs text-muted mt-0.5">{fmtDate(effectiveDate(tx))}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className={`mono text-sm font-medium tabular-nums ${amountClass(tx)}`}>
          {tx.amount >= 0 ? "+" : ""}{fmtAmount(tx.amount, tx.currency)}
        </div>
        <button
          onClick={onDelete}
          disabled={resolved}
          className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("duplicates.deleteTitle")}
        >
          <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
