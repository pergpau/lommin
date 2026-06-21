import { describe, it, expect } from "vitest";
import { normalizeForMatch } from "./store";

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
