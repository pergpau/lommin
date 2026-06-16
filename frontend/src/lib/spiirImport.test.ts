import { describe, expect, it } from "vitest";
import { buildImportPayload, parseSpiirCsvAccounts } from "./spiirImport";

const accountsCsv = `AccountId;AccountName;Currency
acc1;Brukskonto;NOK
acc1;Brukskonto;NOK
acc2;Sparekonto;NOK`;

const postingCsv = `Id;AccountId;Amount;Currency;AccountName;Date;CategoryId;Description;OriginalDescription;Balance;Comment
p1;acc1;-100,50;NOK;Brukskonto;10-01-2024;132;KIWI;KIWI MAJORSTUEN;900,00;
p2;acc1;200,00;NOK;Brukskonto;11-01-2024;;Lønn;;1100,00;`;

describe("parseSpiirCsvAccounts", () => {
  it("parses and de-duplicates accounts", () => {
    const accounts = parseSpiirCsvAccounts(accountsCsv);
    expect(accounts.map((a) => a.accountId)).toEqual(["acc1", "acc2"]);
    expect(accounts[0].name).toBe("Brukskonto");
  });

  it("returns nothing for an empty / header-only file", () => {
    expect(parseSpiirCsvAccounts("AccountId;AccountName;Currency")).toEqual([]);
  });
});

describe("buildImportPayload", () => {
  it("creates a new account for the sentinel and maps transactions", () => {
    const { accounts, transactions } = buildImportPayload(postingCsv, { acc1: "spiir::acc1" });
    expect(accounts).toHaveLength(1);
    expect(transactions).toHaveLength(2);

    const uid = accounts[0].uid;
    expect(accounts[0].sources).toEqual([{ type: "spiir", sourceId: "acc1" }]);

    const p1 = transactions.find((t) => t.entryReference === "p1")!;
    expect(p1.amount).toBeCloseTo(-100.5);
    expect(p1.bookingDate).toBe("2024-01-10");
    expect(p1.categoryId).toBe(133); // Spiir 132 → own 133 (Dagligvarer)
    expect(p1.creditDebit).toBe("DBIT");
    expect(p1.id).toBe(`${uid}::p1`);
    expect(p1.accountUid).toBe(uid);
  });

  it("merges into an existing account uid without creating a record", () => {
    const { accounts, transactions } = buildImportPayload(postingCsv, { acc1: "existing-uid" });
    expect(accounts).toHaveLength(0);
    expect(transactions[0].accountUid).toBe("existing-uid");
  });
});
