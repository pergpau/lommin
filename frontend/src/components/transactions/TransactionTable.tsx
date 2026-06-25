import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PAGE_SIZE } from "../../constants";
import type { Transaction } from "../../lib/data";
import SearchInput from "../ui/SearchInput";
import CategoryPicker from "./CategoryPicker";
import TransactionDetail from "./TransactionDetail";
import TransactionRow from "./TransactionRow";

type TransactionTableProps = {
  transactions: Transaction[];
  pageSize?: number;
  subtitle?: string;
  onCategoryChange?: (transactionId: string, categoryId: number | undefined) => Promise<void>;
  onMutated?: () => void;
};

export default function TransactionTable({
  transactions,
  pageSize = PAGE_SIZE,
  subtitle,
  onCategoryChange,
  onMutated,
}: TransactionTableProps) {
  const { t } = useTranslation("transactions");
  const [page, setPage] = useState(0);
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  const [search, setSearch] = useState("");
  const [pickerFor, setPickerFor] = useState<Transaction | null>(null);
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const detailFor = detailForId ? (transactions.find((tx) => tx.id === detailForId) ?? null) : null;

  if (prevTransactions !== transactions) {
    setPrevTransactions(transactions);
    setPage(0);
  }

  const filtered = search
    ? transactions.filter((tx) => {
      const q = search.toLowerCase();
      return (
        (tx.description ?? "").toLowerCase().includes(q) ||
        String(Math.abs(tx.amount)).includes(q)
      );
    })
    : transactions;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);

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
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 min-h-[44px]">
          <div className="flex-1">
            <h2 className="text-sm font-medium text-text">{t("table.title")}: {filtered.length}</h2>
            {subtitle && <p className="text-xs text-muted leading-tight">{subtitle}</p>}
          </div>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder={t("table.searchPlaceholder")}
          />
        </div>
        <div className="divide-y divide-border">
          {pageItems.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">{t("table.empty")}</div>
          ) : pageItems.map((tx) => (
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
                to: Math.min((page + 1) * pageSize, filtered.length),
                total: filtered.length,
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
          onMutated={onMutated}
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
