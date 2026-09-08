// Transaction view: turns accounts + transactions + a perspective into scoped,
// scaled, exclusion-applied transactions and every aggregation the UI shows.
// See CONTEXT.md for "Perspective", "Personal view", "Shared view", "Ownership share".

import { MAIN_CATEGORIES, MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "./categories";
import { effectiveDate } from "./format";
import { getLocale } from "./i18n";
import type { Account, Transaction } from "./types";

export type Perspective = "personal" | "shared" | "full";

/** A transaction as seen through a perspective. `amount` is untouched (what the bank
 *  recorded); `viewAmount` is what aggregations sum; `share` is set only when the
 *  perspective scales by ownership share, so rows can show a badge. */
export type ViewTransaction = Transaction & { viewAmount: number; share?: number };

export type MonthBar = {
  key: string;
  label: string;
  income: number;
  expenses: number;
  saving: number;
};

export type Section = "income" | "expense" | "saving";
export type MainId = number | "uncategorized" | "uncategorized-income";
export type SubId = number | "uncategorized";

export type MainRow = { mainId: MainId; total: number; count: number };
export type SubRow = {
  subId: SubId;
  total: number;
  count: number;
  mainId: MainId;
  isUncat?: boolean;
};

export type BreakdownSelection = { mainId: MainId; subId?: SubId; excluded?: boolean };

export interface Breakdown {
  isEmpty: boolean;
  /** Main expense categories, largest first. */
  expenseRows: MainRow[];
  /** Sub-categories of the income main category plus an uncategorized-income row. */
  incomeRows: SubRow[];
  savingRows: SubRow[];
  /** Sub-categories of the "exclude" main category (transfers etc.). */
  excludedRows: SubRow[];
  /** Sub-category rows for one main category, largest first. Includes zero-count rows. */
  subRowsFor(mainId: number, excluded?: boolean): SubRow[];
  /** Transactions behind a row, newest first, with their signed total for the header. */
  transactionsFor(sel: BreakdownSelection): { transactions: ViewTransaction[]; total: number };
}

export interface TransactionView {
  mode: Perspective;
  /** Accounts in scope for this perspective. */
  accounts: Account[];
  /** Transactions in scope, newest first. */
  transactions: ViewTransaction[];
  monthly: MonthBar[];
  yearly: MonthBar[];
  byAccount: Map<string, ViewTransaction[]>;
  /** Transactions whose effective date starts with `periodKey` ("2026-08" or "2026"). */
  transactionsIn(periodKey: string | null): ViewTransaction[];
  breakdownIn(periodKey: string | null): Breakdown;
}

export function periodLabel(periodKey: string): string {
  if (periodKey.length === 4) return periodKey;
  return new Date(periodKey + "-15").toLocaleDateString(getLocale(), {
    month: "long",
    year: "numeric",
  });
}

// ── Classification ──────────────────────────────────────────────────────────

function isExcludedCategory(tx: Pick<Transaction, "categoryId">): boolean {
  return tx.categoryId != null && SUB_CATEGORY_MAP[tx.categoryId]?.type === "exclude";
}

/** Which section a transaction counts toward, or null if it is left out of all totals. */
export function sectionOf(
  tx: Pick<Transaction, "excludeFromCalculations" | "categoryId" | "amount">,
): Section | null {
  if (tx.excludeFromCalculations) return null;
  if (tx.categoryId != null) {
    const type = SUB_CATEGORY_MAP[tx.categoryId]?.type;
    if (type === "exclude") return null;
    if (type === "income") return "income";
    if (type === "saving") return "saving";
    return "expense";
  }
  return tx.amount > 0 ? "income" : "expense";
}

function mainIdOf(tx: Pick<Transaction, "categoryId" | "amount">): MainId {
  if (tx.categoryId == null) return tx.amount > 0 ? "uncategorized-income" : "uncategorized";
  const sub = SUB_CATEGORY_MAP[tx.categoryId];
  return sub ? sub.mainCategoryId : "uncategorized";
}

export function mainSection(mainId: MainId): Section {
  if (mainId === "uncategorized") return "expense";
  if (mainId === "uncategorized-income") return "income";
  const cat = MAIN_CATEGORY_MAP[mainId as number];
  const firstType = cat?.subCategories.find((s) => s.type !== "exclude")?.type;
  return firstType === "income" || firstType === "saving" ? firstType : "expense";
}

const INCOME_MAIN_ID = 11;
const SAVING_MAIN_ID = 20;
const EXCLUDE_MAIN_ID = 10;

// ── Aggregation ─────────────────────────────────────────────────────────────

function byNewest(a: ViewTransaction, b: ViewTransaction): number {
  return effectiveDate(b).localeCompare(effectiveDate(a));
}

function bars(txns: ViewTransaction[], keyLength: 4 | 7): MonthBar[] {
  const map = new Map<string, { income: number; expenses: number; saving: number }>();
  for (const tx of txns) {
    const section = sectionOf(tx);
    if (!section) continue;
    const key = effectiveDate(tx).slice(0, keyLength);
    const entry = map.get(key) ?? { income: 0, expenses: 0, saving: 0 };
    if (section === "income") entry.income += tx.viewAmount;
    else if (section === "saving") entry.saving += -tx.viewAmount;
    else entry.expenses += -tx.viewAmount;
    map.set(key, entry);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totals]) => {
      let label = key;
      if (keyLength === 7) {
        const raw = new Date(key + "-15").toLocaleDateString(getLocale(), { month: "long" });
        label = raw.charAt(0).toUpperCase() + raw.slice(1);
      }
      return { key, label, ...totals };
    });
}

function subRows(pool: ViewTransaction[], mainId: number, sign: 1 | -1): SubRow[] {
  const totals = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const tx of pool) {
    if (tx.categoryId != null && mainIdOf(tx) === mainId) {
      totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + sign * tx.viewAmount);
      counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    }
  }
  const cat = MAIN_CATEGORY_MAP[mainId];
  if (!cat) return [];
  return cat.subCategories
    .map((s) => ({
      subId: s.id as SubId,
      total: totals.get(s.id) ?? 0,
      count: counts.get(s.id) ?? 0,
      mainId: mainId as MainId,
    }))
    .sort((a, b) => b.total - a.total);
}

function buildBreakdown(txns: ViewTransaction[]): Breakdown {
  const eligible = txns.filter((tx) => sectionOf(tx) !== null);
  // Drill-down lists include extraordinary (excludeFromCalculations) transactions:
  // they are out of the totals but still belong to a category.
  const nonExcluded = txns.filter((tx) => !isExcludedCategory(tx));
  const excludedPool = txns.filter(isExcludedCategory);

  const mainTotals = new Map<MainId, number>();
  const mainCounts = new Map<MainId, number>();
  for (const tx of eligible) {
    const id = mainIdOf(tx);
    const delta = mainSection(id) === "income" ? tx.viewAmount : -tx.viewAmount;
    mainTotals.set(id, (mainTotals.get(id) ?? 0) + delta);
    mainCounts.set(id, (mainCounts.get(id) ?? 0) + 1);
  }
  const expenseRows: MainRow[] = MAIN_CATEGORIES.filter(
    (cat) =>
      cat.subCategories.some((s) => s.type !== "exclude") && mainSection(cat.id) === "expense",
  ).map((cat) => ({
    mainId: cat.id as MainId,
    total: mainTotals.get(cat.id) ?? 0,
    count: mainCounts.get(cat.id) ?? 0,
  }));
  if (mainCounts.has("uncategorized")) {
    expenseRows.push({
      mainId: "uncategorized",
      total: mainTotals.get("uncategorized")!,
      count: mainCounts.get("uncategorized")!,
    });
  }
  expenseRows.sort((a, b) => b.total - a.total);

  const incomeRows = subRows(eligible, INCOME_MAIN_ID, 1);
  const uncatIncome = eligible.filter((tx) => mainIdOf(tx) === "uncategorized-income");
  if (uncatIncome.length > 0) {
    incomeRows.push({
      subId: "uncategorized",
      total: uncatIncome.reduce((sum, tx) => sum + tx.viewAmount, 0),
      count: uncatIncome.length,
      mainId: "uncategorized-income",
      isUncat: true,
    });
    incomeRows.sort((a, b) => b.total - a.total);
  }

  return {
    isEmpty: eligible.length === 0 && excludedPool.length === 0,
    expenseRows,
    incomeRows,
    savingRows: subRows(eligible, SAVING_MAIN_ID, -1),
    excludedRows: subRows(excludedPool, EXCLUDE_MAIN_ID, -1),
    subRowsFor(mainId, excluded) {
      const pool = excluded ? excludedPool : nonExcluded;
      const sign = mainSection(mainId) === "income" ? 1 : -1;
      return subRows(pool, mainId, sign);
    },
    transactionsFor({ mainId, subId, excluded }) {
      const pool = excluded ? excludedPool : nonExcluded;
      let transactions = pool.filter((tx) => mainIdOf(tx) === mainId);
      let sign: 1 | -1 = mainSection(mainId) === "income" ? 1 : -1;
      if (subId !== undefined) {
        transactions = pool.filter((tx) =>
          subId === "uncategorized" ? tx.categoryId == null : tx.categoryId === subId,
        );
        const subType = subId !== "uncategorized" ? SUB_CATEGORY_MAP[subId]?.type : undefined;
        sign = subType === "income" ? 1 : -1;
      }
      const total = transactions.reduce((sum, tx) => sum + sign * tx.viewAmount, 0);
      return { transactions, total };
    },
  };
}

// ── The view ────────────────────────────────────────────────────────────────

export function buildView(input: {
  accounts: Account[];
  transactions: Transaction[];
  mode: Perspective;
}): TransactionView {
  const { mode } = input;
  const accounts =
    mode === "shared" ? input.accounts.filter((acc) => acc.ownershipShare != null) : input.accounts;
  const shareByUid = new Map<string, number>();
  if (mode === "personal") {
    for (const acc of accounts) {
      if (acc.ownershipShare != null) shareByUid.set(acc.uid, acc.ownershipShare);
    }
  }
  const inScope = new Set(accounts.map((acc) => acc.uid));

  const transactions: ViewTransaction[] = input.transactions
    .filter((tx) => inScope.has(tx.accountUid))
    .map((tx) => {
      const share = shareByUid.get(tx.accountUid);
      return share != null
        ? { ...tx, share, viewAmount: tx.amount * share }
        : { ...tx, viewAmount: tx.amount };
    })
    .sort(byNewest);

  const byAccount = new Map<string, ViewTransaction[]>();
  for (const tx of transactions) {
    const list = byAccount.get(tx.accountUid) ?? [];
    list.push(tx);
    byAccount.set(tx.accountUid, list);
  }

  const transactionsIn = (periodKey: string | null): ViewTransaction[] =>
    periodKey ? transactions.filter((tx) => effectiveDate(tx).startsWith(periodKey)) : transactions;

  return {
    mode,
    accounts,
    transactions,
    monthly: bars(transactions, 7),
    yearly: bars(transactions, 4),
    byAccount,
    transactionsIn,
    breakdownIn: (periodKey) => buildBreakdown(transactionsIn(periodKey)),
  };
}
