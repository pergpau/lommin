import { describe, expect, it } from "vitest";
import { buildView, sectionOf } from "./transactionView";
import type { Account, Transaction } from "./types";

// Category ids from categories.ts: 100 Overføring (exclude), 103 Lønn (income),
// 130 Parkering (expense, main 13 Transport), 182 (saving, main 20).
const OVERFORING = 100;
const LONN = 103;
const PARKERING = 130;
const SPARING = 182;

function account(uid: string, ownershipShare?: number): Account {
  return { uid, name: uid, addedAt: 0, sources: [], ownershipShare };
}

let seq = 0;
function tx(accountUid: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  const entryReference = `e${++seq}`;
  return {
    id: `${accountUid}::${entryReference}`,
    accountUid,
    entryReference,
    bookingDate: "2025-03-15",
    transactionDate: "2025-03-15",
    amount,
    currency: "NOK",
    description: "",
    status: "BOOK",
    excludeFromCalculations: false,
    raw: {},
    ...overrides,
  };
}

const mine = account("mine");
const joint = account("joint", 0.5);
const accounts = [mine, joint];

describe("sectionOf", () => {
  it("leaves out extraordinary and exclude-category transactions", () => {
    expect(sectionOf(tx("mine", -100, { excludeFromCalculations: true }))).toBeNull();
    expect(sectionOf(tx("mine", -100, { categoryId: OVERFORING }))).toBeNull();
  });

  it("classifies by category type, falling back to amount sign", () => {
    expect(sectionOf(tx("mine", 30000, { categoryId: LONN }))).toBe("income");
    expect(sectionOf(tx("mine", -5000, { categoryId: SPARING }))).toBe("saving");
    expect(sectionOf(tx("mine", -500, { categoryId: PARKERING }))).toBe("expense");
    expect(sectionOf(tx("mine", 500))).toBe("income");
    expect(sectionOf(tx("mine", -500))).toBe("expense");
  });
});

describe("buildView perspectives", () => {
  const transactions = [tx("mine", -100), tx("joint", -200)];

  it("personal: every account, shared ones scaled by ownership share", () => {
    const v = buildView({ accounts, transactions, mode: "personal" });
    expect(v.accounts.map((a) => a.uid)).toEqual(["mine", "joint"]);
    const byUid = Object.fromEntries(v.transactions.map((t) => [t.accountUid, t]));
    expect(byUid.mine.viewAmount).toBe(-100);
    expect(byUid.mine.share).toBeUndefined();
    expect(byUid.joint.viewAmount).toBe(-100);
    expect(byUid.joint.amount).toBe(-200);
    expect(byUid.joint.share).toBe(0.5);
    expect(v.monthly[0].expenses).toBe(200);
  });

  it("shared: only shared accounts, at full value, no share badge", () => {
    const v = buildView({ accounts, transactions, mode: "shared" });
    expect(v.accounts.map((a) => a.uid)).toEqual(["joint"]);
    expect(v.transactions).toHaveLength(1);
    expect(v.transactions[0].viewAmount).toBe(-200);
    expect(v.transactions[0].share).toBeUndefined();
    expect(v.monthly[0].expenses).toBe(200);
  });

  it("full: the given accounts at full value", () => {
    const v = buildView({ accounts: [joint], transactions, mode: "full" });
    expect(v.transactions).toHaveLength(1);
    expect(v.transactions[0].viewAmount).toBe(-200);
    expect(v.transactions[0].share).toBeUndefined();
  });

  it("drops transactions whose account is not in scope", () => {
    const v = buildView({ accounts: [mine], transactions, mode: "personal" });
    expect(v.transactions.map((t) => t.accountUid)).toEqual(["mine"]);
    expect(v.byAccount.has("joint")).toBe(false);
  });
});

describe("buildView ordering and periods", () => {
  const transactions = [
    tx("mine", -100, { transactionDate: "2025-01-05" }),
    tx("mine", -100, { transactionDate: "2025-06-01" }),
    tx("mine", -100, { transactionDate: "2025-03-01", customDate: "2024-12-20" }),
  ];
  const v = buildView({ accounts, transactions, mode: "personal" });

  it("sorts newest first by effective date", () => {
    expect(v.transactions.map((t) => t.customDate ?? t.transactionDate)).toEqual([
      "2025-06-01",
      "2025-01-05",
      "2024-12-20",
    ]);
  });

  it("narrows to a month or a year, or returns everything", () => {
    expect(v.transactionsIn("2025-01")).toHaveLength(1);
    expect(v.transactionsIn("2025")).toHaveLength(2);
    expect(v.transactionsIn("2024")).toHaveLength(1);
    expect(v.transactionsIn(null)).toHaveLength(3);
  });

  it("groups bars by month and by year, chronologically, using customDate", () => {
    expect(v.monthly.map((b) => b.key)).toEqual(["2024-12", "2025-01", "2025-06"]);
    expect(v.yearly.map((b) => b.key)).toEqual(["2024", "2025"]);
    expect(v.yearly[1].expenses).toBe(200);
    expect(v.yearly[1].label).toBe("2025");
  });
});

describe("buildView bars", () => {
  it("separates income, expenses and saving and skips excluded", () => {
    const v = buildView({
      accounts,
      transactions: [
        tx("mine", 30000, { categoryId: LONN }),
        tx("mine", -500),
        tx("mine", -2000, { categoryId: SPARING }),
        tx("mine", -999, { excludeFromCalculations: true }),
        tx("mine", -777, { categoryId: OVERFORING }),
      ],
      mode: "personal",
    });
    expect(v.monthly).toHaveLength(1);
    expect(v.monthly[0]).toMatchObject({ income: 30000, expenses: 500, saving: 2000 });
  });

  it("returns no bars for no transactions", () => {
    expect(buildView({ accounts, transactions: [], mode: "personal" }).monthly).toEqual([]);
  });
});

describe("buildView breakdown", () => {
  const transactions = [
    tx("mine", -300, { categoryId: PARKERING }),
    tx("joint", -400, { categoryId: PARKERING }),
    tx("mine", -50),
    tx("mine", 30000, { categoryId: LONN }),
    tx("mine", 25),
    tx("mine", -2000, { categoryId: SPARING }),
    tx("mine", -777, { categoryId: OVERFORING }),
    tx("mine", -111, { categoryId: PARKERING, excludeFromCalculations: true }),
  ];
  const b = buildView({ accounts, transactions, mode: "personal" }).breakdownIn(null);

  it("sums expense main categories with scaled amounts and adds an uncategorized row", () => {
    const transport = b.expenseRows.find((r) => r.mainId === 13)!;
    expect(transport.total).toBe(500); // 300 + 400 * 0.5
    expect(transport.count).toBe(2);
    const uncat = b.expenseRows.find((r) => r.mainId === "uncategorized")!;
    expect(uncat).toMatchObject({ total: 50, count: 1 });
    expect(b.expenseRows[0].mainId).toBe(13);
  });

  it("builds income, saving and excluded rows", () => {
    expect(b.incomeRows.find((r) => r.subId === LONN)?.total).toBe(30000);
    expect(b.incomeRows.find((r) => r.isUncat)).toMatchObject({ total: 25, count: 1 });
    expect(b.savingRows.find((r) => r.subId === SPARING)?.total).toBe(2000);
    expect(b.excludedRows.find((r) => r.subId === OVERFORING)?.total).toBe(777);
    expect(b.isEmpty).toBe(false);
  });

  it("subRowsFor lists every sub-category of a main, largest first, drill-down pool", () => {
    // Drill-down rows come from the non-excluded pool, so the extraordinary 111 counts here.
    const rows = b.subRowsFor(13);
    expect(rows[0]).toMatchObject({ subId: PARKERING, total: 611, count: 3 });
    expect(rows.some((r) => r.count === 0)).toBe(true);
  });

  it("transactionsFor keeps extraordinary transactions in drill-down lists", () => {
    const { transactions: list, total } = b.transactionsFor({ mainId: 13, subId: PARKERING });
    expect(list).toHaveLength(3);
    expect(total).toBe(500 + 111);
  });

  it("transactionsFor resolves uncategorized rows and excluded pools", () => {
    expect(b.transactionsFor({ mainId: "uncategorized" }).transactions).toHaveLength(1);
    expect(b.transactionsFor({ mainId: "uncategorized-income" }).total).toBe(25);
    const ex = b.transactionsFor({ mainId: 10, subId: OVERFORING, excluded: true });
    expect(ex.transactions).toHaveLength(1);
    expect(ex.total).toBe(777);
  });

  it("is empty when nothing is in the period", () => {
    const empty = buildView({ accounts, transactions, mode: "personal" }).breakdownIn("1999");
    expect(empty.isEmpty).toBe(true);
  });
});
