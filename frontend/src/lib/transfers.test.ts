import { describe, expect, it } from "vitest";
import { detectTransfers } from "./transfers";
import type { Transaction } from "./types";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(),
    accountUid: "acc-a",
    entryReference: "",
    amount: -100,
    currency: "NOK",
    description: "",
    status: "BOOK",
    raw: {},
    bookingDate: "2024-01-01",
    transactionDate: "2024-01-01",
    ...overrides,
  };
}

describe("detectTransfers", () => {
  it("matches a pair with opposite signs across accounts", () => {
    const out = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const inn = tx({ id: "b", accountUid: "acc-b", amount: 1000, bookingDate: "2024-01-01" });
    const result = detectTransfers([out, inn]);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
  });

  it("does not match same account", () => {
    const a = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const b = tx({ id: "b", accountUid: "acc-a", amount: 1000, bookingDate: "2024-01-01" });
    expect(detectTransfers([a, b]).size).toBe(0);
  });

  it("does not match outside 3-day window", () => {
    const out = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const inn = tx({ id: "b", accountUid: "acc-b", amount: 1000, bookingDate: "2024-01-05" });
    expect(detectTransfers([out, inn]).size).toBe(0);
  });

  it("does not match same-sign transactions", () => {
    const a = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const b = tx({ id: "b", accountUid: "acc-b", amount: -1000, bookingDate: "2024-01-01" });
    expect(detectTransfers([a, b]).size).toBe(0);
  });

  it("matches next-day transfers (1-day gap)", () => {
    const out = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const inn = tx({ id: "b", accountUid: "acc-b", amount: 1000, bookingDate: "2024-01-02" });
    const result = detectTransfers([out, inn]);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
  });

  it("each transaction matched at most once", () => {
    const out = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const in1 = tx({ id: "b", accountUid: "acc-b", amount: 1000, bookingDate: "2024-01-01" });
    const in2 = tx({ id: "c", accountUid: "acc-c", amount: 1000, bookingDate: "2024-01-01" });
    const result = detectTransfers([out, in1, in2]);
    expect(result.size).toBe(2);
  });

  it("maps each matched transaction to its partner's id", () => {
    const out = tx({ id: "a", accountUid: "acc-a", amount: -1000, bookingDate: "2024-01-01" });
    const inn = tx({ id: "b", accountUid: "acc-b", amount: 1000, bookingDate: "2024-01-01" });
    const result = detectTransfers([out, inn]);
    expect(result.get("a")).toBe("b");
    expect(result.get("b")).toBe("a");
  });
});
