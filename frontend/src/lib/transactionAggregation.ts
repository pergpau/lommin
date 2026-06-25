import type { MonthBar } from "../components/charts/MonthlyChart";
import { SUB_CATEGORY_MAP } from "./categories";
import { effectiveDate } from "./format";
import { getLocale } from "./i18n";
import type { Transaction } from "./types";

type TxLike = Pick<Transaction, "excludeFromCalculations" | "categoryId" | "amount" | "customDate" | "transactionDate">;

export function txSection(tx: TxLike): "income" | "expense" | "saving" | null {
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

function aggregate(txns: TxLike[], sliceEnd: number): MonthBar[] {
  const map = new Map<string, { income: number; expenses: number; saving: number }>();
  for (const tx of txns) {
    const section = txSection(tx);
    if (!section) continue;
    const date = effectiveDate(tx);
    if (!date) continue;
    const key = date.slice(0, sliceEnd);
    const entry = map.get(key) ?? { income: 0, expenses: 0, saving: 0 };
    if (section === "income") entry.income += tx.amount;
    else if (section === "saving") entry.saving += -tx.amount;
    else entry.expenses += -tx.amount;
    map.set(key, entry);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { income, expenses, saving }]) => {
      let label = key;
      if (sliceEnd === 7) {
        const d = new Date(key + "-15");
        const raw = d.toLocaleDateString(getLocale(), { month: "long" });
        label = raw.charAt(0).toUpperCase() + raw.slice(1);
      }
      return { key, label, income, expenses, saving };
    });
}

export function buildMonthlyData(txns: TxLike[]): MonthBar[] {
  return aggregate(txns, 7);
}

export function buildYearlyData(txns: TxLike[]): MonthBar[] {
  return aggregate(txns, 4);
}
