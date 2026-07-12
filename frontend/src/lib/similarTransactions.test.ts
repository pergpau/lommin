import { describe, expect, it } from "vitest";
import { findSimilarUncategorized } from "./similarTransactions";
import type { Transaction } from "./types";

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "default",
    accountUid: "acc1",
    entryReference: "ref",
    bookingDate: "2024-01-01",
    transactionDate: "2024-01-01",
    amount: -100,
    currency: "NOK",
    description: "Test",
    status: "BOOK",
    excludeFromCalculations: false,
    raw: {},
    ...overrides,
  };
}

describe("findSimilarUncategorized", () => {
  it("finds uncategorized transactions with same creditorName", () => {
    const source = tx({ id: "1", creditorName: "REMA 1000" });
    const all = [
      source,
      tx({ id: "2", creditorName: "REMA 1000" }),
      tx({ id: "3", creditorName: "REMA 1000" }),
      tx({ id: "4", creditorName: "KIWI" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2", "3"]);
  });

  it("excludes the source transaction", () => {
    const source = tx({ id: "1", creditorName: "REMA 1000" });
    const all = [source];
    expect(findSimilarUncategorized(source, all)).toEqual([]);
  });

  it("excludes already-categorized transactions", () => {
    const source = tx({ id: "1", creditorName: "REMA 1000" });
    const all = [
      source,
      tx({ id: "2", creditorName: "REMA 1000", categoryId: 133 }),
      tx({ id: "3", creditorName: "REMA 1000" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["3"]);
  });

  it("matches by BBAN pair when no creditorName", () => {
    const source = tx({ id: "1", from_bban: "1234", to_bban: "5678" });
    const all = [
      source,
      tx({ id: "2", from_bban: "1234", to_bban: "5678" }),
      tx({ id: "3", from_bban: "1234", to_bban: "9999" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("prefers creditorName over BBAN matching", () => {
    const source = tx({ id: "1", creditorName: "REMA 1000", from_bban: "1234", to_bban: "5678" });
    const all = [
      source,
      tx({ id: "2", from_bban: "1234", to_bban: "5678" }),
      tx({ id: "3", creditorName: "REMA 1000" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["3"]);
  });

  it("returns empty when no creditorName, no BBAN, and no rule match", () => {
    const source = tx({ id: "1", description: "something random" });
    const all = [source, tx({ id: "2", description: "totally unrelated" })];
    expect(findSimilarUncategorized(source, all)).toEqual([]);
  });

  it("works across different accounts", () => {
    const source = tx({ id: "1", accountUid: "acc1", creditorName: "REMA 1000" });
    const all = [source, tx({ id: "2", accountUid: "acc2", creditorName: "REMA 1000" })];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("falls back to BTC rule matching when no creditorName", () => {
    const source = tx({ id: "1", bankTransactionCode: "GROCERY STORES" });
    const all = [
      source,
      tx({ id: "2", bankTransactionCode: "GROCERY STORES" }),
      tx({ id: "3", bankTransactionCode: "TAXICABS" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("falls back to description rule matching", () => {
    const source = tx({ id: "1", description: "Kiwi Majorstuen" });
    const all = [
      source,
      tx({ id: "2", description: "Rema 1000 Grønland" }),
      tx({ id: "3", description: "Something else" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("falls back to creditor regex rule matching", () => {
    const source = tx({ id: "1", creditorName: "RUTER AS" });
    const all = [
      source,
      tx({ id: "2", creditorName: "RUTER" }),
      tx({ id: "3", creditorName: "KIWI" }),
    ];
    // No exact creditorName match for "RUTER AS", but CREDITOR_RULES regex /\bRUTER\b/i matches both
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("prefers creditorName match over rule fallback", () => {
    const source = tx({ id: "1", creditorName: "RUTER AS", bankTransactionCode: "TAXICABS" });
    const all = [
      source,
      tx({ id: "2", creditorName: "RUTER AS" }),
      tx({ id: "3", bankTransactionCode: "TAXICABS" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("skips ambiguous FINANCIAL INST BTC codes", () => {
    const source = tx({ id: "1", bankTransactionCode: "FINANCIAL INST SERVICES", description: "" });
    const all = [source, tx({ id: "2", bankTransactionCode: "FINANCIAL INST SERVICES" })];
    expect(findSimilarUncategorized(source, all)).toEqual([]);
  });

  it("matches by description word overlap when nothing else matches", () => {
    const source = tx({ id: "1", description: "2869 COOP PRIX HOYBRATEN OSLO NO" });
    const all = [
      source,
      tx({ id: "2", description: "3312 COOP PRIX MAJORSTUEN OSLO NO" }),
      tx({ id: "3", description: "RUTER OSLO NO" }),
    ];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("does not match on a single shared word that is exactly half the words", () => {
    const source = tx({ id: "1", description: "RUTER OSLO NO" });
    const all = [source, tx({ id: "2", description: "KIWI OSLO NO" })];
    expect(findSimilarUncategorized(source, all)).toEqual([]);
  });

  it("matches identical single-word descriptions via word overlap", () => {
    const source = tx({ id: "1", description: "Spotify" });
    const all = [source, tx({ id: "2", description: "Spotify" })];
    const result = findSimilarUncategorized(source, all);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });
});
