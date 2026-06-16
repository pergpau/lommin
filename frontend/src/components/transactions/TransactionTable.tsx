import { useState } from "react";
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
};

export default function TransactionTable({
  transactions,
  pageSize = PAGE_SIZE,
  title,
  onCategoryChange,
}: TransactionTableProps) {
  const [page, setPage] = useState(0);
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  const [pickerFor, setPickerFor] = useState<Transaction | null>(null);
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const detailFor = detailForId ? (transactions.find((t) => t.id === detailForId) ?? null) : null;

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
      <div className="card p-10 text-center text-muted text-sm">Ingen transaksjoner funnet.</div>
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
          {pageItems.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              onClick={() => setDetailForId(t.id)}
              onCategoryClick={onCategoryChange ? () => setPickerFor(t) : undefined}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, transactions.length)} av{" "}
              {transactions.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                ← Forrige
              </button>
              <button
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Neste →
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
              ? (t) => {
                  setPickerFor(t);
                }
              : undefined
          }
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
