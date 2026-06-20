import { makeTransactionId, type Transaction } from "./store";
import { guessCategory } from "./autoCategorize";

export interface CsvTransactionDraft {
  entryReference: string;
  bookingDate: string;
  transactionDate: string;
  amount: number;
  description: string;
  currency: string | undefined;
  status: string;
  creditDebit: "CRDT" | "DBIT";
  raw: Record<string, string>;
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  drafts: CsvTransactionDraft[];
  errors: ParseError[];
}

const REQUIRED_COLUMNS = ["booking_date", "transaction_date", "amount", "description"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // trailing comma produced empty field; handled below
      break;
    }
    if (line[i] === '"') {
      i++;
      let field = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
      // handle trailing comma → empty last field
      if (i === line.length) {
        fields.push("");
        break;
      }
    }
  }
  return fields;
}

export function parseCsvImport(text: string): ParseResult {
  const cleaned = text.startsWith("﻿") ? text.slice(1) : text;
  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) {
    return { drafts: [], errors: [{ row: 0, message: "File is empty" }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  for (const req of REQUIRED_COLUMNS) {
    if (!headers.includes(req)) {
      return {
        drafts: [],
        errors: [{ row: 0, message: `Missing required column: ${req}` }],
      };
    }
  }

  const col = (fields: string[], name: string): string => {
    const idx = headers.indexOf(name);
    return idx === -1 ? "" : (fields[idx] ?? "").trim();
  };

  const drafts: CsvTransactionDraft[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const fields = parseCsvLine(lines[i]);

    const bookingDate = col(fields, "booking_date");
    const transactionDate = col(fields, "transaction_date");
    const amountStr = col(fields, "amount");
    const description = col(fields, "description");
    const idVal = col(fields, "id");
    const currencyVal = col(fields, "currency") || undefined;
    const statusVal = col(fields, "status").toUpperCase();

    if (!DATE_RE.test(bookingDate)) {
      errors.push({
        row: rowNum,
        message: `Row ${rowNum}: invalid booking_date "${bookingDate}" — expected YYYY-MM-DD`,
      });
      continue;
    }
    if (!DATE_RE.test(transactionDate)) {
      errors.push({
        row: rowNum,
        message: `Row ${rowNum}: invalid transaction_date "${transactionDate}" — expected YYYY-MM-DD`,
      });
      continue;
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: invalid amount "${amountStr}"` });
      continue;
    }
    if (!description) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: description is empty` });
      continue;
    }

    const entryReference = idVal || crypto.randomUUID();
    const status = statusVal === "PNDG" ? "PNDG" : "BOOK";
    const creditDebit: "CRDT" | "DBIT" = amount > 0 ? "CRDT" : "DBIT";

    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      raw[headers[j]] = (fields[j] ?? "").trim();
    }

    drafts.push({
      entryReference,
      bookingDate,
      transactionDate,
      amount,
      description,
      currency: currencyVal,
      status,
      creditDebit,
      raw,
    });
  }

  return { drafts, errors };
}

export function buildCsvTransactions(
  drafts: CsvTransactionDraft[],
  accountUid: string,
  accountCurrency: string,
): Transaction[] {
  return drafts.map((d) => {
    const currency = d.currency ?? accountCurrency;
    const t: Transaction = {
      id: makeTransactionId(accountUid, d.entryReference),
      accountUid,
      entryReference: d.entryReference,
      bookingDate: d.bookingDate,
      transactionDate: d.transactionDate,
      amount: d.amount,
      currency,
      creditDebit: d.creditDebit,
      description: d.description,
      status: d.status,
      excludeFromCalculations: false,
      raw: d.raw,
    };
    const cat = guessCategory(t);
    if (cat !== undefined) t.categoryId = cat;
    return t;
  });
}

export function detectCsvCurrency(drafts: CsvTransactionDraft[]): string {
  const counts = new Map<string, number>();
  for (const d of drafts) {
    if (d.currency) counts.set(d.currency, (counts.get(d.currency) ?? 0) + 1);
  }
  if (counts.size === 0) return "NOK";
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
