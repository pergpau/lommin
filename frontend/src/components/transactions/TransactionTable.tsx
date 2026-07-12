import { faListCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PAGE_SIZE } from "../../constants";
import { useSimilarSuggestions } from "../../hooks/useSimilarSuggestions";
import type { Transaction } from "../../lib/data";
import {
  batchDeleteTransactions,
  batchSetCategoryId,
  batchSetComment,
  batchSetCustomDate,
  batchSetExcludeFromCalculations,
} from "../../lib/data";
import { effectiveDate, fmtDate } from "../../lib/format";
import DeleteConfirmModal from "../ui/DeleteConfirmModal";
import SearchInput from "../ui/SearchInput";
import BulkActionBar from "./BulkActionBar";
import BulkEditSheet, { type BulkEditChanges } from "./BulkEditSheet";
import CategoryPicker from "./CategoryPicker";
import { SimilarSuggestions } from "./SimilarTransactionsModal";
import TransactionDetail from "./TransactionDetail";
import TransactionRow from "./TransactionRow";

type TransactionTableProps = {
  transactions: Transaction[];
  pageSize?: number;
  subtitle?: string;
  onCategoryChange?: (transactionId: string, categoryId: number | undefined) => Promise<void>;
  onMutated?: () => void;
  shareMap?: Map<string, number>;
};

export default function TransactionTable({
  transactions,
  pageSize = PAGE_SIZE,
  subtitle,
  onCategoryChange,
  onMutated,
  shareMap,
}: TransactionTableProps) {
  const { t } = useTranslation("transactions");
  const [page, setPage] = useState(0);
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  const [search, setSearch] = useState("");
  const [pickerFor, setPickerFor] = useState<Transaction | null>(null);
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const { suggestions, checkForSimilar, applySuggestions, closeSuggestions } =
    useSimilarSuggestions(onMutated);
  const detailFor = detailForId ? (transactions.find((tx) => tx.id === detailForId) ?? null) : null;

  const canSelect = !!onMutated;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  if (prevTransactions !== transactions) {
    setPrevTransactions(transactions);
    setPage(0);
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existing = new Set(transactions.map((tx) => tx.id));
      const next = new Set([...prev].filter((id) => existing.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  const filtered = search
    ? transactions.filter((tx) => {
        const q = search.toLowerCase();
        return (
          (tx.description ?? "").toLowerCase().includes(q) ||
          String(Math.abs(tx.amount)).includes(q) ||
          fmtDate(effectiveDate(tx)).toLowerCase().includes(q)
        );
      })
    : transactions;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const selectedFilteredCount = filtered.reduce(
    (acc, tx) => acc + (selectedIds.has(tx.id) ? 1 : 0),
    0,
  );
  const allSelected = filtered.length > 0 && selectedFilteredCount === filtered.length;
  const someSelected = selectedFilteredCount > 0;

  async function handleCategorySelect(categoryId: number | undefined) {
    if (!pickerFor || !onCategoryChange) return;
    const tx = pickerFor;
    await onCategoryChange(tx.id, categoryId);
    setPickerFor(null);
    await checkForSimilar(tx, categoryId);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((tx) => next.delete(tx.id));
      else filtered.forEach((tx) => next.add(tx.id));
      return next;
    });
  }

  function enterSelectMode(firstId?: string) {
    setSelectMode(true);
    if (firstId) setSelectedIds(new Set([firstId]));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkEditOpen(false);
    setBulkDeleteOpen(false);
  }

  async function applyBulkEdit(changes: BulkEditChanges) {
    const ids = [...selectedIds];
    if (changes.categoryId) await batchSetCategoryId(ids, changes.categoryId.value);
    if (changes.customDate) await batchSetCustomDate(ids, changes.customDate.value);
    if (changes.excludeFromCalculations)
      await batchSetExcludeFromCalculations(ids, changes.excludeFromCalculations.value);
    if (changes.comment) await batchSetComment(ids, changes.comment.value);
    exitSelectMode();
    onMutated?.();
  }

  async function applyBulkDelete() {
    await batchDeleteTransactions([...selectedIds]);
    setBulkDeleteOpen(false);
    setBulkEditOpen(false);
    setSelectedIds(new Set());
    onMutated?.();
  }

  if (transactions.length === 0) {
    return <div className="card p-10 text-center text-muted text-sm">{t("table.empty")}</div>;
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 min-h-[44px]">
          <div className={"flex-1" + (selectMode ? " invisible sm:visible" : "")}>
            <h2 className="text-sm font-medium text-text">
              {t("table.title")}: {filtered.length}
            </h2>
            {subtitle && <p className="text-xs text-muted leading-tight">{subtitle}</p>}
          </div>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder={t("table.searchPlaceholder")}
          />
          {selectMode && (
            <label className="flex items-center gap-2 shrink-0 cursor-pointer text-sm text-text">
              <span className="hidden sm:inline">{t("bulk.selectAll")}</span>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-accent"
              />
            </label>
          )}
          {canSelect && (
            <button
              className={
                "shrink-0 hidden sm:flex w-8 h-8 items-center justify-center rounded-md text-xs transition-colors " +
                (selectMode
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:bg-surface-2 hover:text-text")
              }
              onClick={() => (selectMode ? exitSelectMode() : enterSelectMode())}
              title={selectMode ? t("bulk.done") : t("bulk.select")}
              aria-label={selectMode ? t("bulk.done") : t("bulk.select")}
              aria-pressed={selectMode}
            >
              <FontAwesomeIcon icon={faListCheck} />
            </button>
          )}
        </div>
        <div className="divide-y divide-border">
          {pageItems.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">{t("table.empty")}</div>
          ) : (
            pageItems.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onClick={() => setDetailForId(tx.id)}
                onCategoryClick={onCategoryChange ? () => setPickerFor(tx) : undefined}
                ownershipShare={shareMap?.get(tx.accountUid)}
                selectMode={selectMode}
                selected={selectedIds.has(tx.id)}
                onToggleSelect={() => toggleSelect(tx.id)}
                onLongPress={canSelect ? () => enterSelectMode(tx.id) : undefined}
              />
            ))
          )}
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

      {selectMode && !bulkEditOpen && (
        <BulkActionBar
          count={selectedIds.size}
          onEdit={() => setBulkEditOpen(true)}
          onClose={exitSelectMode}
        />
      )}

      {bulkEditOpen && (
        <BulkEditSheet
          transactions={transactions.filter((tx) => selectedIds.has(tx.id))}
          onSave={(changes) => void applyBulkEdit(changes)}
          onDelete={() => setBulkDeleteOpen(true)}
          onClose={() => setBulkEditOpen(false)}
        />
      )}

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

      <DeleteConfirmModal
        open={bulkDeleteOpen}
        title={t("bulk.deleteTitle", { count: selectedIds.size })}
        body={t("bulk.deleteBody", { count: selectedIds.size })}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void applyBulkDelete()}
      />

      <SimilarSuggestions
        suggestions={suggestions}
        onApply={applySuggestions}
        onClose={closeSuggestions}
      />
    </>
  );
}
