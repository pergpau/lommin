import { describe, expect, it } from "vitest";
import { findMatchingAccount, type Account } from "./types";

function account(partial: Partial<Account> & { uid: string }): Account {
  return { addedAt: 0, sources: [], ...partial };
}

const existing: Account[] = [
  account({ uid: "a", iban: "NO9386011117947", identificationHash: "hash-a" }),
  account({ uid: "b", bban: "8601 11 17947" }),
  account({ uid: "c", sources: [{ type: "spiir", sourceId: "spiir-1" }] }),
];

describe("findMatchingAccount", () => {
  it("matches on identification hash", () => {
    expect(findMatchingAccount(existing, { identificationHash: "hash-a" })?.uid).toBe("a");
  });

  it("matches on IBAN", () => {
    expect(findMatchingAccount(existing, { iban: "NO9386011117947" })?.uid).toBe("a");
  });

  it("matches on BBAN ignoring formatting", () => {
    expect(findMatchingAccount(existing, { bban: "86011117947" })?.uid).toBe("b");
    expect(findMatchingAccount(existing, { bban: "8601.11.17947" })?.uid).toBe("b");
  });

  it("matches on an attached external source", () => {
    expect(
      findMatchingAccount(existing, { source: { type: "spiir", sourceId: "spiir-1" } })?.uid,
    ).toBe("c");
    expect(
      findMatchingAccount(existing, { source: { type: "demo", sourceId: "spiir-1" } }),
    ).toBeUndefined();
  });

  it("never matches on missing identifiers", () => {
    expect(findMatchingAccount(existing, {})).toBeUndefined();
    expect(findMatchingAccount(existing, { iban: "", bban: "", identificationHash: "" })).toBe(
      undefined,
    );
  });
});
