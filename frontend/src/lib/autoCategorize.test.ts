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
    ...partial,
  };
}

describe("guessCategory", () => {
  it("matches a grocery merchant from the description", () => {
    expect(guessCategory(tx({ description: "KIWI MAJORSTUEN" }))).toBe(133);
  });

  it("matches a creditor-name rule", () => {
    expect(guessCategory(tx({ raw: { creditor: { name: "RUTER AS" } } }))).toBe(128);
  });

  it("matches a BTC code", () => {
    expect(
      guessCategory(tx({ raw: { bank_transaction_code: { description: "GROCERY STORES" } } })),
    ).toBe(133);
  });

  it("lets the user history override the rules", () => {
    const history = new Map([["FOOBAR", 999]]);
    expect(guessCategory(tx({ raw: { creditor: { name: "FOOBAR" } } }), history)).toBe(999);
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
    expect(
      guessCategory(tx({ raw: { bank_transaction_code: { description: "FINANCIAL INST" } } })),
    ).toBeUndefined();
  });
});
