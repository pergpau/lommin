import type { Account, Transaction } from "./types";
import i18n, { getLocale } from "./i18n";

export function fmtDate(s?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(getLocale(), options ?? { month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

export function statusLabel(status: string): string {
  return status === "PNDG" ? i18n.t("transactions:status.pending") : status;
}

const DEFAULT_CURRENCY = "NOK";

// Format a money amount. NOK is the assumed currency, so its code is omitted;
// any other currency is shown explicitly.
export function fmtAmount(amount: number, currency?: string, fractionDigits = 2): string {
  const cur = currency || DEFAULT_CURRENCY;
  if (cur === DEFAULT_CURRENCY) {
    return new Intl.NumberFormat(getLocale(), {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(fractionDigits)} ${cur}`;
  }
}

// Human label for an account: "Bank Name (Account name)". Never the UUID.
export function accountLabel(acc: Pick<Account, "bankName" | "name">): string {
  const bank = acc.bankName?.trim();
  const name = acc.name?.trim();
  if (bank && name) return `${bank} (${name})`;
  return bank || name || "Konto";
}

export function effectiveDate(tx: Pick<Transaction, "customDate" | "transactionDate">): string {
  return tx.customDate ?? tx.transactionDate;
}

// Credit = green, debit = red. Falls back to sign when the
// indicator is missing (debit stored as a negative amount).
export function amountClass(t: Pick<Transaction, "creditDebit" | "amount">): string {
  const isDebit = t.creditDebit ? t.creditDebit === "DBIT" : t.amount < 0;
  return isDebit ? "amount-negative" : "amount-positive";
}
