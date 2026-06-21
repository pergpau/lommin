import { describe, expect, it } from "vitest";
import { txSection, buildMonthlyData, buildYearlyData } from "./transactionAggregation";

function makeTx(overrides: Partial<{
  excludeFromCalculations: boolean;
  categoryId: number | undefined;
  amount: number;
  customDate: string;
  transactionDate: string;
}> = {}) {
  return {
    excludeFromCalculations: false,
    categoryId: undefined as number | undefined,
    amount: -100,
    customDate: undefined as string | undefined,
    transactionDate: "2025-03-15",
    ...overrides,
  };
}

describe("txSection", () => {
  it("returns null for excluded transactions", () => {
    expect(txSection(makeTx({ excludeFromCalculations: true }))).toBeNull();
  });

  it("returns null for exclude-category transactions", () => {
    expect(txSection(makeTx({ categoryId: 100 }))).toBeNull();
  });

  it("returns income for income-category transactions", () => {
    expect(txSection(makeTx({ categoryId: 103, amount: 30000 }))).toBe("income");
  });

  it("returns saving for saving-category transactions", () => {
    expect(txSection(makeTx({ categoryId: 182, amount: -5000 }))).toBe("saving");
  });

  it("returns expense for expense-category transactions", () => {
    expect(txSection(makeTx({ categoryId: 130, amount: -500 }))).toBe("expense");
  });

  it("falls back to amount sign when no category: positive = income", () => {
    expect(txSection(makeTx({ amount: 500 }))).toBe("income");
  });

  it("falls back to amount sign when no category: negative = expense", () => {
    expect(txSection(makeTx({ amount: -500 }))).toBe("expense");
  });
});

describe("buildMonthlyData", () => {
  it("returns empty array for no transactions", () => {
    expect(buildMonthlyData([])).toEqual([]);
  });

  it("groups transactions by month", () => {
    const txns = [
      makeTx({ amount: -200, transactionDate: "2025-03-10" }),
      makeTx({ amount: -300, transactionDate: "2025-03-20" }),
      makeTx({ amount: -100, transactionDate: "2025-04-05" }),
    ];
    const result = buildMonthlyData(txns);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("2025-03");
    expect(result[0].expenses).toBe(500);
    expect(result[1].key).toBe("2025-04");
    expect(result[1].expenses).toBe(100);
  });

  it("separates income, expenses, and savings", () => {
    const txns = [
      makeTx({ amount: 30000, transactionDate: "2025-03-01" }),
      makeTx({ amount: -500, transactionDate: "2025-03-05" }),
      makeTx({ amount: -2000, categoryId: 182, transactionDate: "2025-03-10" }),
    ];
    const result = buildMonthlyData(txns);
    expect(result).toHaveLength(1);
    expect(result[0].income).toBe(30000);
    expect(result[0].expenses).toBe(500);
    expect(result[0].saving).toBe(2000);
  });

  it("sorts chronologically", () => {
    const txns = [
      makeTx({ amount: -100, transactionDate: "2025-06-01" }),
      makeTx({ amount: -100, transactionDate: "2025-01-01" }),
      makeTx({ amount: -100, transactionDate: "2025-03-01" }),
    ];
    const result = buildMonthlyData(txns);
    expect(result.map((b) => b.key)).toEqual(["2025-01", "2025-03", "2025-06"]);
  });

  it("skips excluded transactions", () => {
    const txns = [
      makeTx({ amount: -100, transactionDate: "2025-03-01" }),
      makeTx({ amount: -200, transactionDate: "2025-03-01", excludeFromCalculations: true }),
    ];
    const result = buildMonthlyData(txns);
    expect(result[0].expenses).toBe(100);
  });

  it("uses customDate over transactionDate", () => {
    const txns = [
      makeTx({ amount: -100, transactionDate: "2025-03-01", customDate: "2025-05-01" }),
    ];
    const result = buildMonthlyData(txns);
    expect(result[0].key).toBe("2025-05");
  });
});

describe("buildYearlyData", () => {
  it("groups transactions by year", () => {
    const txns = [
      makeTx({ amount: -200, transactionDate: "2024-03-10" }),
      makeTx({ amount: -300, transactionDate: "2024-11-20" }),
      makeTx({ amount: -100, transactionDate: "2025-04-05" }),
    ];
    const result = buildYearlyData(txns);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("2024");
    expect(result[0].expenses).toBe(500);
    expect(result[0].label).toBe("2024");
    expect(result[1].key).toBe("2025");
    expect(result[1].expenses).toBe(100);
  });

  it("sorts chronologically", () => {
    const txns = [
      makeTx({ amount: -100, transactionDate: "2026-01-01" }),
      makeTx({ amount: -100, transactionDate: "2024-01-01" }),
    ];
    const result = buildYearlyData(txns);
    expect(result.map((b) => b.key)).toEqual(["2024", "2026"]);
  });
});
