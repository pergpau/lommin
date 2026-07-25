import { describe, expect, it } from "vitest";
import { guessCategory } from "./autoCategorize";
import type { Transaction } from "./types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "x",
    accountUid: "a",
    entryReference: "r",
    amount: -100,
    currency: "NOK",
    creditDebit: "DBIT",
    description: "",
    status: "BOOK",
    raw: {},
    excludeFromCalculations: false,
    bookingDate: "",
    transactionDate: "",
    ...partial,
  };
}

describe("guessCategory", () => {
  it("matches a grocery merchant from the description", () => {
    expect(guessCategory(tx({ description: "KIWI MAJORSTUEN" }))).toBe(133);
  });

  it("matches a creditor-name rule", () => {
    expect(guessCategory(tx({ creditorName: "RUTER AS" }))).toBe(128);
  });

  it("matches a BTC code", () => {
    expect(guessCategory(tx({ bankTransactionCode: "GROCERY STORES" }))).toBe(133);
  });

  it("lets the user history override the rules", () => {
    const history = new Map([["FOOBAR", 999]]);
    expect(guessCategory(tx({ creditorName: "FOOBAR" }), history)).toBe(999);
  });

  it('returns "other income" for incoming payments labelled innbetaling', () => {
    expect(
      guessCategory(tx({ creditDebit: "CRDT", amount: 500, description: "Innbetaling lønn" })),
    ).toBe(113);
  });

  it("returns undefined for an unrecognised expense", () => {
    expect(guessCategory(tx({ description: "zzz totally unknown merchant" }))).toBeUndefined();
  });

  it("ignores ambiguous FINANCIAL INST codes", () => {
    expect(guessCategory(tx({ bankTransactionCode: "FINANCIAL INST" }))).toBeUndefined();
  });

  it("lets a detected transfer override a matching rule", () => {
    const transferIds = new Set(["x"]);
    expect(
      guessCategory(tx({ description: "KIWI MAJORSTUEN" }), undefined, undefined, transferIds),
    ).toBe(100);
  });

  it("ignores bban history when the debtor is one of the user's own accounts", () => {
    // A bill paid from the user's own account (from_bban = own, no creditor account).
    // The debtor side alone must not reuse the last bill's category.
    const bbanHistory = new Map([["OWN→", 999]]);
    const ownBbans = new Set(["OWN"]);
    expect(
      guessCategory(tx({ from_bban: "OWN" }), undefined, bbanHistory, undefined, ownBbans),
    ).toBeUndefined();
  });

  it("still matches bban history on the counterparty when the debtor is an own account", () => {
    const bbanHistory = new Map([["→PAYEE", 555]]);
    const ownBbans = new Set(["OWN"]);
    expect(
      guessCategory(
        tx({ from_bban: "OWN", to_bban: "PAYEE" }),
        undefined,
        bbanHistory,
        undefined,
        ownBbans,
      ),
    ).toBe(555);
  });

  it("lets a detected transfer override creditor and bban history", () => {
    const creditorHistory = new Map([["FOOBAR", 999]]);
    const bbanHistory = new Map([["A→B", 999]]);
    const transferIds = new Set(["x"]);
    expect(
      guessCategory(
        tx({ creditorName: "FOOBAR", from_bban: "A", to_bban: "B" }),
        creditorHistory,
        bbanHistory,
        transferIds,
      ),
    ).toBe(100);
  });
});
