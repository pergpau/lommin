import { useState } from "react";
import { getAllTransactions, batchSetCategoryId, type Transaction } from "../lib/data";
import { findSimilarUncategorized } from "../lib/similarTransactions";

const MAX_SUGGESTIONS = 25;

export interface SuggestionsState {
  transactions: Transaction[];
  categoryId: number;
  totalCount: number;
}

export function useSimilarSuggestions(onMutated?: () => void) {
  const [suggestions, setSuggestions] = useState<SuggestionsState | null>(null);

  async function checkForSimilar(
    sourceTx: Transaction,
    categoryId: number | undefined,
  ): Promise<void> {
    if (categoryId == null) return;

    const all = await getAllTransactions();
    const similar = findSimilarUncategorized(sourceTx, all);

    if (similar.length > 0) {
      setSuggestions({
        transactions: similar.slice(0, MAX_SUGGESTIONS),
        categoryId,
        totalCount: similar.length,
      });
    }
  }

  async function applySuggestions(selectedIds: string[]): Promise<void> {
    if (!suggestions || selectedIds.length === 0) {
      setSuggestions(null);
      return;
    }
    await batchSetCategoryId(selectedIds, suggestions.categoryId);
    setSuggestions(null);
    onMutated?.();
  }

  function closeSuggestions(): void {
    setSuggestions(null);
  }

  return { suggestions, checkForSimilar, applySuggestions, closeSuggestions };
}
