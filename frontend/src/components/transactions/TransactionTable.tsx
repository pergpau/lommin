import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Transaction } from "../../lib/store";
import { PAGE_SIZE } from "../../constants";
import CategoryPicker from "./CategoryPicker";
import TransactionDetail from "./TransactionDetail";
import TransactionRow from "./TransactionRow";

type TransactionTableProps = {
  transactions: Transaction[];
  pageSize?: number;
  title?: string;
  onCategoryChange?: (transactionId: string, categoryId: number | undefined) => Promise<void>;
  onIsExtraordinaryChange?: (transactionId: string, value: boolean) => Promise<void>;
  onCustomDateChange?: (transactionId: string, date: string | undefined) => Promise<void>;
  onDelete?: (transactionId: string) => Promise<void>;
};

export default function TransactionTable({
  transactions,
  pageSize = PAGE_SIZE,
  title,
  onCategoryChange,
  onIsExtraordinaryChange,
  onCustomDateChange,
  onDelete,
}: TransactionTableProps) {
  const { t } = useTranslation("transactions");
  const [page, setPage] = useState(0);
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  const [pickerFor, setPickerFor] = useState<Transaction | null>(null);
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const detailFor = detailForId ? (transactions.find((tx) => tx.id === detailForId) ?? null) : null;

  if (prevTransactions !== transactions) {
    setPrevTransactions(transactions);
    setPage(0);
  }

  const totalPages = Math.ceil(transactions.length / pageSize);
  const pageItems = transactions.slice(page * pageSize, (page + 1) * pageSize);

  async function handleCategorySelect(categoryId: number | undefined) {
    if (!pickerFor || !onCategoryChange) return;
    await onCategoryChange(pickerFor.id, categoryId);
    setPickerFor(null);
  }

  if (transactions.length === 0) {
    return (
      <div className="card p-10 text-center text-muted text-sm">{t("table.empty")}</div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        {title && (
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-text">{title}</h2>
          </div>
        )}
        <div className="divide-y divide-border">
          {pageItems.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onClick={() => setDetailForId(tx.id)}
              onCategoryClick={onCategoryChange ? () => setPickerFor(tx) : undefined}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted">
              {t("table.pagination", {
                from: page * pageSize + 1,
                to: Math.min((page + 1) * pageSize, transactions.length),
                total: transactions.length,
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t("table.prevPage")}
              </button>
              <button
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                {t("table.nextPage")}
              </button>
            </div>
          </div>
        )}
      </div>

      {detailFor && (
        <TransactionDetail
          transaction={detailFor}
          onClose={() => setDetailForId(null)}
          onOpenCategoryPicker={
            onCategoryChange
              ? (tx) => {
                  setPickerFor(tx);
                }
              : undefined
          }
          onIsExtraordinaryChange={onIsExtraordinaryChange}
          onCustomDateChange={onCustomDateChange}
          onDelete={onDelete}
        />
      )}

      {pickerFor && (
        <CategoryPicker
          currentCategoryId={pickerFor.categoryId}
          onSelect={handleCategorySelect}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  );
}
