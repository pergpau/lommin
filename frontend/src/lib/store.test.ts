import { describe, it, expect } from "vitest";
import { shouldTagAsTransfer } from "./store";
import { normalizeForMatch } from "./types";

describe("normalizeForMatch", () => {
  it("strips leading timestamp and normalizes whitespace", () => {
    expect(normalizeForMatch("06-20 18:14:45 2869 COOP PRIX HOYBRATEN OSLO NO")).toBe(
      "2869 coop prix hoybraten oslo no",
    );
  });

  it("collapses excessive whitespace", () => {
    expect(normalizeForMatch("2869 COOP PRIX HOYBRATEN  OSLO          NO")).toBe(
      "2869 coop prix hoybraten oslo no",
    );
  });

  it("pending and booked descriptions normalize to the same value", () => {
    const pending = normalizeForMatch("06-20 18:14:45 2869 COOP PRIX HOYBRATEN OSLO NO");
    const booked = normalizeForMatch("2869 COOP PRIX HOYBRATEN  OSLO          NO");
    expect(pending).toBe(booked);
  });

  it("handles empty string", () => {
    expect(normalizeForMatch("")).toBe("");
  });

  it("lowercases and trims", () => {
    expect(normalizeForMatch("  REMA 1000  ")).toBe("rema 1000");
  });
});

describe("shouldTagAsTransfer", () => {
  it("tags an uncategorized transaction", () => {
    expect(shouldTagAsTransfer(undefined, undefined)).toBe(true);
  });

  it("overrides an existing category when the partner is confirmed a transfer", () => {
    expect(shouldTagAsTransfer(5, 100)).toBe(true);
  });

  it("leaves an already-tagged transfer alone", () => {
    expect(shouldTagAsTransfer(100, undefined)).toBe(false);
  });

  it("does not override an unconfirmed category when the partner isn't a transfer either", () => {
    expect(shouldTagAsTransfer(5, 7)).toBe(false);
    expect(shouldTagAsTransfer(5, undefined)).toBe(false);
  });
});
