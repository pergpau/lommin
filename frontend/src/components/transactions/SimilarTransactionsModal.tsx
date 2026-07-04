import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Transaction } from "../../lib/data";
import { SUB_CATEGORY_MAP } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { effectiveDate, fmtAmount, fmtDate } from "../../lib/format";
import type { SuggestionsState } from "../../hooks/useSimilarSuggestions";

/**
 * Renders the suggestions modal when there is state to show; renders nothing otherwise.
 * Lets host components drop in a single element instead of repeating the null-guard and
 * prop spreading.
 */
export function SimilarSuggestions({
  suggestions,
  onApply,
  onClose,
}: {
  suggestions: SuggestionsState | null;
  onApply: (selectedIds: string[]) => void;
  onClose: () => void;
}) {
  if (!suggestions) return null;
  return (
    <SimilarTransactionsModal
      transactions={suggestions.transactions}
      categoryId={suggestions.categoryId}
      totalCount={suggestions.totalCount}
      onApply={onApply}
      onClose={onClose}
    />
  );
}

interface SimilarTransactionsModalProps {
  transactions: Transaction[];
  categoryId: number;
  totalCount: number;
  onApply: (selectedIds: string[]) => void;
  onClose: () => void;
}

export default function SimilarTransactionsModal({
  transactions,
  categoryId,
  totalCount,
  onApply,
  onClose,
}: SimilarTransactionsModalProps) {
  const { t } = useTranslation(["transactions", "categories"]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(transactions.map((tx) => tx.id)),
  );

  const sub = SUB_CATEGORY_MAP[categoryId];
  const allSelected = selectedIds.size === transactions.length;
  const overflow = totalCount - transactions.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)));
    }
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md mx-4 shadow-xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-text">
            {t("transactions:similarSuggestions.title")}
          </h3>
          <p className="text-xs text-muted mt-1">
            {t("transactions:similarSuggestions.description", { count: totalCount })}
            {sub && (
              <span className="inline-flex items-center gap-1 ml-1.5 text-accent">
                <FontAwesomeIcon icon={getCategoryIcon(categoryId)} className="w-3 h-3" />
                {t("categories:sub." + categoryId)}
              </span>
            )}
          </p>
        </div>

        {/* Select all */}
        <label className="flex items-center gap-2.5 px-5 py-2 border-y border-border cursor-pointer select-none hover:bg-surface-2 transition-colors">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 accent-accent cursor-pointer"
          />
          <span className="text-xs font-medium text-text">
            {t("transactions:similarSuggestions.selectAll")}
          </span>
        </label>

        {/* Transaction list */}
        <div className="overflow-y-auto flex-1">
          {transactions.map((tx) => (
            <label
              key={tx.id}
              className="flex items-center gap-2.5 px-5 py-2.5 cursor-pointer select-none hover:bg-surface-2 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(tx.id)}
                onChange={() => toggle(tx.id)}
                className="w-4 h-4 accent-accent cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">{tx.description || "—"}</div>
                <div className="text-xs text-muted">{fmtDate(effectiveDate(tx))}</div>
              </div>
              <div className="mono text-sm tabular-nums shrink-0">
                {fmtAmount(tx.amount, tx.currency)}
              </div>
            </label>
          ))}

          {overflow > 0 && (
            <div className="px-5 py-2 text-xs text-muted">
              {t("transactions:similarSuggestions.andMore", { count: overflow })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={onClose}>
            {t("transactions:similarSuggestions.skip")}
          </button>
          <button
            className="btn-primary text-xs px-3 py-1.5"
            disabled={selectedIds.size === 0}
            onClick={() => onApply([...selectedIds])}
          >
            {t("transactions:similarSuggestions.apply", { count: selectedIds.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
