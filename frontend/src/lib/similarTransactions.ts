import { findMatchingRulePredicate } from "./autoCategorize";
import { normalizeForMatch } from "./types";
import type { Transaction } from "./types";

// Generic filler words common in bank remittance text that shouldn't count as a
// significant match signal on their own (mirrors the /vipps/i special-case in duplicates.ts).
const DESCRIPTION_WORD_STOPWORDS = new Set([
  "vipps",
  "betaling",
  "overføring",
  "faktura",
  "kjøp",
  "nettbank",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    normalizeForMatch(text)
      .split(/[^\p{L}\p{N}]+/gu)
      .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !DESCRIPTION_WORD_STOPWORDS.has(w)),
  );
}

function sharedWordRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / Math.max(a.size, b.size);
}

export function findSimilarUncategorized(source: Transaction, all: Transaction[]): Transaction[] {
  const uncategorized = all.filter((t) => t.id !== source.id && t.categoryId == null);

  const hasCreditor = !!source.creditorName;
  const hasBban = !hasCreditor && !!source.to_bban && !!source.from_bban;

  // Ordered by specificity: exact creditor, then exact bban pair, then a category rule,
  // then description word overlap (a majority of significant words shared).
  // Each candidate is lazy — later predicates are only built if earlier ones find nothing.
  const candidates: Array<() => ((t: Transaction) => boolean) | null> = [
    () => (hasCreditor ? (t) => t.creditorName === source.creditorName : null),
    () =>
      hasBban ? (t) => t.to_bban === source.to_bban && t.from_bban === source.from_bban : null,
    () => findMatchingRulePredicate(source),
    () => {
      const words = significantWords(source.matchDescription ?? source.description);
      if (words.size === 0) return null;
      return (t) =>
        sharedWordRatio(words, significantWords(t.matchDescription ?? t.description)) > 0.5;
    },
  ];

  for (const getPredicate of candidates) {
    const predicate = getPredicate();
    if (!predicate) continue;
    const matched = uncategorized.filter(predicate);
    if (matched.length > 0) return matched;
  }

  return [];
}
