import { describe, expect, it } from "vitest";
import {
  asArray,
  asRecord,
  isRecord,
  optNumber,
  optString,
  reqString,
  ValidationError,
} from "./validate";

describe("isRecord", () => {
  it("accepts plain objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(5)).toBe(false);
  });
});

describe("asRecord", () => {
  it("returns the record when valid", () => {
    expect(asRecord({ a: 1 }, "x")).toEqual({ a: 1 });
  });
  it("throws ValidationError on non-records", () => {
    expect(() => asRecord([], "liste")).toThrow(ValidationError);
    expect(() => asRecord(null, "null")).toThrow(/null/);
  });
});

describe("asArray", () => {
  it("returns the array when valid", () => {
    expect(asArray([1, 2], "x")).toEqual([1, 2]);
  });
  it("throws on non-arrays", () => {
    expect(() => asArray({}, "obj")).toThrow(ValidationError);
  });
});

describe("optString / optNumber", () => {
  it("returns the value or undefined", () => {
    expect(optString("a")).toBe("a");
    expect(optString(5)).toBeUndefined();
    expect(optNumber(5)).toBe(5);
    expect(optNumber(NaN)).toBeUndefined();
    expect(optNumber("5")).toBeUndefined();
  });
});

describe("reqString", () => {
  it("returns non-empty strings", () => {
    expect(reqString("a", "f")).toBe("a");
  });
  it("throws on missing/empty/wrong-type", () => {
    expect(() => reqString("", "f")).toThrow(ValidationError);
    expect(() => reqString(undefined, "f")).toThrow(/f/);
    expect(() => reqString(5, "f")).toThrow(ValidationError);
  });
});
