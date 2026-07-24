import type { Transaction } from "./types";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Returns a map of transaction id -> matched partner's id, for transactions that are
// internal transfers between tracked accounts. Matching criteria: different accounts,
// same currency, same absolute amount (±0.001), opposite signs, booking dates within
// 3 days of each other. Greedy — each transaction is matched at most once.
export function detectTransfers(transactions: Transaction[]): Map<string, string> {
  const buckets = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = `${t.currency}::${Math.round(Math.abs(t.amount) * 100)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(t);
    buckets.set(key, bucket);
  }

  const transferPairs = new Map<string, string>();
  const matched = new Set<string>();

  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const a = bucket[i];
      if (matched.has(a.id)) continue;
      for (let j = i + 1; j < bucket.length; j++) {
        const b = bucket[j];
        if (matched.has(b.id)) continue;
        if (a.accountUid === b.accountUid) continue;
        if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > 0.001) continue;
        if (Math.sign(a.amount) === Math.sign(b.amount)) continue;

        const aTime = new Date(a.bookingDate || a.transactionDate).getTime();
        const bTime = new Date(b.bookingDate || b.transactionDate).getTime();
        if (!isFinite(aTime) || !isFinite(bTime)) continue;
        if (Math.abs(aTime - bTime) > THREE_DAYS_MS) continue;

        transferPairs.set(a.id, b.id);
        transferPairs.set(b.id, a.id);
        matched.add(a.id);
        matched.add(b.id);
        break;
      }
    }
  }

  return transferPairs;
}
