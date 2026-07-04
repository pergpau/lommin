import { findMatchingRulePredicate } from "./autoCategorize";
import type { Transaction } from "./types";

export function findSimilarUncategorized(source: Transaction, all: Transaction[]): Transaction[] {
  const uncategorized = all.filter((t) => t.id !== source.id && t.categoryId == null);

  const hasCreditor = !!source.creditorName;
  const hasBban = !hasCreditor && !!source.to_bban && !!source.from_bban;

  // Ordered by specificity: exact creditor, then exact bban pair, then a category rule.
  // Each candidate is lazy — later predicates are only built if earlier ones find nothing.
  const candidates: Array<() => ((t: Transaction) => boolean) | null> = [
    () => (hasCreditor ? (t) => t.creditorName === source.creditorName : null),
    () =>
      hasBban ? (t) => t.to_bban === source.to_bban && t.from_bban === source.from_bban : null,
    () => findMatchingRulePredicate(source),
  ];

  for (const getPredicate of candidates) {
    const predicate = getPredicate();
    if (!predicate) continue;
    const matched = uncategorized.filter(predicate);
    if (matched.length > 0) return matched;
  }

  return [];
}
