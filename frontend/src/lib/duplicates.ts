import { SUB_CATEGORY_MAP } from "./categories";
import type { Transaction } from "./store";

function daysDiff(a: string, b: string): number {
  return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function isExcludedCategory(tx: Transaction): boolean {
  if (tx.categoryId == null) return false;
  return SUB_CATEGORY_MAP[tx.categoryId]?.type === "exclude" || tx.categoryId === 128 || tx.categoryId === 155 || tx.categoryId === 156;
}

const FOOD_CATEGORY_IDS = new Set([133, 134, 135, 136, 155, 156]);

function isFoodCategorized(tx: Transaction): boolean {
  return tx.categoryId != null && FOOD_CATEGORY_IDS.has(tx.categoryId);
}

export function pairKey(a: Transaction, b: Transaction): string {
  return [a.id, b.id].sort().join("::");
}

export function filterVisiblePairs(
  pairs: [Transaction, Transaction][],
  dismissedKeys: Set<string>,
): [Transaction, Transaction][] {
  return pairs.filter(([a, b]) => {
    if (dismissedKeys.has(pairKey(a, b))) return false;
    if (isFoodCategorized(a) && isFoodCategorized(b)) return false;
    if (/vipps/i.test(a.description ?? "") || /vipps/i.test(b.description ?? "")) return false;
    return true;
  });
}

export function detectDuplicatePairs(transactions: Transaction[]): [Transaction, Transaction][] {
  const buckets = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = `${tx.accountUid}::${tx.amount.toFixed(2)}`;
    const list = buckets.get(key) ?? [];
    list.push(tx);
    buckets.set(key, list);
  }

  const pairs: [Transaction, Transaction][] = [];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (isExcludedCategory(a) || isExcludedCategory(b)) continue;
        if (daysDiff(a.bookingDate, b.bookingDate) <= 1) {
          pairs.push([a, b]);
        }
      }
    }
  }
  return pairs;
}
