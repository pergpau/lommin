import { describe, it, expect } from "vitest";
import { parseCsvImport, buildCsvTransactions, detectCsvCurrency } from "./csvImport";

const BASE_CSV = `booking_date,transaction_date,amount,description
2024-01-15,2024-01-14,-499.00,Rema 1000
2024-01-16,2024-01-16,15000.00,Lønn januar`;

describe("parseCsvImport", () => {
  it("parses a valid CSV with required columns", () => {
    const { drafts, errors } = parseCsvImport(BASE_CSV);
    expect(errors).toHaveLength(0);
    expect(drafts).toHaveLength(2);

    const [t1, t2] = drafts;
    expect(t1.bookingDate).toBe("2024-01-15");
    expect(t1.transactionDate).toBe("2024-01-14");
    expect(t1.amount).toBe(-499);
    expect(t1.description).toBe("Rema 1000");
    expect(t1.creditDebit).toBe("DBIT");
    expect(t1.status).toBe("BOOK");
    expect(t1.currency).toBeUndefined();

    expect(t2.amount).toBe(15000);
    expect(t2.creditDebit).toBe("CRDT");
  });

  it("uses id column as entryReference when present", () => {
    const csv = `id,booking_date,transaction_date,amount,description
abc-123,2024-01-15,2024-01-14,-100.00,Test`;
    const { drafts } = parseCsvImport(csv);
    expect(drafts[0].entryReference).toBe("abc-123");
  });

  it("generates UUID when id column is absent", () => {
    const { drafts } = parseCsvImport(BASE_CSV);
    expect(drafts[0].entryReference).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("generates UUID when id cell is empty", () => {
    const csv = `id,booking_date,transaction_date,amount,description
,2024-01-15,2024-01-14,-100.00,Test`;
    const { drafts } = parseCsvImport(csv);
    expect(drafts[0].entryReference).toMatch(/-/);
  });

  it("returns a header-level error for a missing required column", () => {
    const csv = `booking_date,amount,description
2024-01-15,-100.00,Test`;
    const { drafts, errors } = parseCsvImport(csv);
    expect(drafts).toHaveLength(0);
    expect(errors[0].row).toBe(0);
    expect(errors[0].message).toContain("transaction_date");
  });

  it("produces a row-level error for an invalid booking_date", () => {
    const csv = `booking_date,transaction_date,amount,description
01/01/2024,2024-01-01,-100.00,Test
2024-01-02,2024-01-02,-50.00,Valid`;
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].description).toBe("Valid");
  });

  it("produces a row-level error for an invalid transaction_date", () => {
    const csv = `booking_date,transaction_date,amount,description
2024-01-01,not-a-date,-100.00,Test`;
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors[0].message).toContain("transaction_date");
    expect(drafts).toHaveLength(0);
  });

  it("produces a row-level error for an invalid amount", () => {
    const csv = `booking_date,transaction_date,amount,description
2024-01-01,2024-01-01,abc,Test`;
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors[0].message).toContain("amount");
    expect(drafts).toHaveLength(0);
  });

  it("rejects zero amount", () => {
    const csv = `booking_date,transaction_date,amount,description
2024-01-01,2024-01-01,0,Test`;
    const { errors } = parseCsvImport(csv);
    expect(errors).toHaveLength(1);
  });

  it("produces a row-level error for an empty description", () => {
    const csv = `booking_date,transaction_date,amount,description
2024-01-01,2024-01-01,-100.00,`;
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors[0].message).toContain("description");
    expect(drafts).toHaveLength(0);
  });

  it("uses currency column when present", () => {
    const csv = `booking_date,transaction_date,amount,description,currency
2024-01-01,2024-01-01,-100.00,Test,EUR`;
    const { drafts } = parseCsvImport(csv);
    expect(drafts[0].currency).toBe("EUR");
  });

  it("sets currency to undefined when currency column is missing", () => {
    const { drafts } = parseCsvImport(BASE_CSV);
    expect(drafts[0].currency).toBeUndefined();
  });

  it("parses PNDG status", () => {
    const csv = `booking_date,transaction_date,amount,description,status
2024-01-01,2024-01-01,-100.00,Test,PNDG`;
    const { drafts } = parseCsvImport(csv);
    expect(drafts[0].status).toBe("PNDG");
  });

  it("defaults status to BOOK", () => {
    const { drafts } = parseCsvImport(BASE_CSV);
    expect(drafts[0].status).toBe("BOOK");
  });

  it("handles Windows CRLF line endings", () => {
    const csv = "booking_date,transaction_date,amount,description\r\n2024-01-01,2024-01-01,-100.00,Test\r\n";
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors).toHaveLength(0);
    expect(drafts).toHaveLength(1);
  });

  it("strips UTF-8 BOM", () => {
    const csv = "﻿booking_date,transaction_date,amount,description\n2024-01-01,2024-01-01,-100.00,Test";
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors).toHaveLength(0);
    expect(drafts).toHaveLength(1);
  });

  it("handles quoted description containing a comma", () => {
    const csv = `booking_date,transaction_date,amount,description
2024-01-01,2024-01-01,-100.00,"Café, Paris"`;
    const { drafts, errors } = parseCsvImport(csv);
    expect(errors).toHaveLength(0);
    expect(drafts[0].description).toBe("Café, Paris");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = `booking_date,transaction_date,amount,description
2024-01-01,2024-01-01,-100.00,"He said ""hello"""`;
    const { drafts } = parseCsvImport(csv);
    expect(drafts[0].description).toBe('He said "hello"');
  });

  it("stores all columns in raw", () => {
    const csv = `booking_date,transaction_date,amount,description,currency
2024-01-01,2024-01-01,-100.00,Test,NOK`;
    const { drafts } = parseCsvImport(csv);
    expect(drafts[0].raw["currency"]).toBe("NOK");
    expect(drafts[0].raw["description"]).toBe("Test");
  });

  it("returns empty error for empty file", () => {
    const { drafts, errors } = parseCsvImport("   \n  ");
    expect(drafts).toHaveLength(0);
    expect(errors[0].row).toBe(0);
  });
});

describe("buildCsvTransactions", () => {
  it("uses account currency as fallback when row has no currency", () => {
    const { drafts } = parseCsvImport(BASE_CSV);
    const txns = buildCsvTransactions(drafts, "uid-1", "NOK");
    expect(txns[0].currency).toBe("NOK");
    expect(txns[0].accountUid).toBe("uid-1");
    expect(txns[0].isExtraordinary).toBe(false);
  });

  it("uses row currency over account currency when present", () => {
    const csv = `booking_date,transaction_date,amount,description,currency
2024-01-01,2024-01-01,-100.00,Test,EUR`;
    const { drafts } = parseCsvImport(csv);
    const txns = buildCsvTransactions(drafts, "uid-1", "NOK");
    expect(txns[0].currency).toBe("EUR");
  });

  it("sets creditDebit based on amount sign", () => {
    const { drafts } = parseCsvImport(BASE_CSV);
    const txns = buildCsvTransactions(drafts, "uid-1", "NOK");
    expect(txns[0].creditDebit).toBe("DBIT");
    expect(txns[1].creditDebit).toBe("CRDT");
  });

  it("builds composite id from accountUid and entryReference", () => {
    const csv = `id,booking_date,transaction_date,amount,description
ref-42,2024-01-01,2024-01-01,-100.00,Test`;
    const { drafts } = parseCsvImport(csv);
    const txns = buildCsvTransactions(drafts, "uid-1", "NOK");
    expect(txns[0].id).toBe("uid-1::ref-42");
    expect(txns[0].entryReference).toBe("ref-42");
  });
});

describe("detectCsvCurrency", () => {
  it("returns the most common currency", () => {
    const { drafts } = parseCsvImport(`booking_date,transaction_date,amount,description,currency
2024-01-01,2024-01-01,-100.00,A,NOK
2024-01-02,2024-01-02,-200.00,B,EUR
2024-01-03,2024-01-03,-300.00,C,NOK`);
    expect(detectCsvCurrency(drafts)).toBe("NOK");
  });

  it("defaults to NOK when no currency column", () => {
    const { drafts } = parseCsvImport(BASE_CSV);
    expect(detectCsvCurrency(drafts)).toBe("NOK");
  });
});
