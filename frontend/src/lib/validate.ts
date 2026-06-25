// Lightweight runtime validation for data crossing a trust boundary:
// Enable Banking API responses and imported backup / Spiir files. The shapes are
// declared by an external system (or an attacker-supplied file), so we validate
// before mapping or persisting instead of trusting `as` casts. Kept dependency-free
// (no Zod) — these guards are small and the surface is narrow.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (!isRecord(v)) throw new ValidationError(`Ugyldig data: forventet et objekt for ${what}.`);
  return v;
}

export function asArray(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new ValidationError(`Ugyldig data: forventet en liste for ${what}.`);
  return v;
}

// Tolerant readers — return undefined when the field is missing or the wrong type,
// for genuinely optional fields where a bad value should be dropped, not fatal.
export function optString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function optNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// Strict reader — throws when a required string is missing/empty/wrong type.
export function reqString(v: unknown, what: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new ValidationError(`Ugyldig data: mangler tekstfeltet ${what}.`);
  }
  return v;
}

export interface SyncedSettings {
  proxyUrl: string;
  lookbackDays: number;
  backupMethod: string;
  driveAutosave: boolean;
  usePassphrase: boolean;
  dismissedPairs: string[];
}

import type { Account, AccountSource, SyncCursor, Transaction } from "./types";

export interface ImportData {
  accounts: Account[];
  transactions: Transaction[];
  cursors: SyncCursor[];
  settings?: SyncedSettings;
}

function validateAccountSource(v: unknown, where: string): AccountSource {
  const s = asRecord(v, where);
  if (s.type !== "enableBanking" && s.type !== "spiir" && s.type !== "demo" && s.type !== "manual") {
    throw new ValidationError(`Ugyldig data: ukjent kildetype i ${where}.`);
  }
  return {
    type: s.type,
    sourceId: reqString(s.sourceId, `${where}.sourceId`),
    sessionId: optString(s.sessionId),
  };
}

function validateAccount(v: unknown, i: number): Account {
  const a = asRecord(v, `account[${i}]`);
  return {
    uid: reqString(a.uid, `account[${i}].uid`),
    name: optString(a.name),
    bankName: optString(a.bankName),
    bankCountry: optString(a.bankCountry),
    currency: optString(a.currency),
    iban: optString(a.iban),
    bban: optString(a.bban),
    identificationHash: optString(a.identificationHash),
    identificationHashes: Array.isArray(a.identificationHashes)
      ? a.identificationHashes.filter((h): h is string => typeof h === "string")
      : undefined,
    addedAt: optNumber(a.addedAt) ?? Date.now(),
    balance: optNumber(a.balance),
    balanceFetchedAt: optNumber(a.balanceFetchedAt),
    sources: asArray(a.sources ?? [], `account[${i}].sources`).map((s, j) =>
      validateAccountSource(s, `account[${i}].sources[${j}]`),
    ),
  };
}

function validateTransaction(v: unknown, i: number): Transaction {
  const t = asRecord(v, `transaction[${i}]`);
  const amount = optNumber(t.amount);
  if (amount === undefined)
    throw new ValidationError(`Ugyldig data: transaction[${i}] mangler gyldig beløp.`);
  return {
    id: reqString(t.id, `transaction[${i}].id`),
    accountUid: reqString(t.accountUid, `transaction[${i}].accountUid`),
    entryReference: optString(t.entryReference) ?? "",
    bookingDate: optString(t.bookingDate) ?? "",
    transactionDate: optString(t.transactionDate) ?? optString(t.bookingDate) ?? "",
    customDate: optString(t.customDate),
    amount,
    currency: optString(t.currency) ?? "",
    creditDebit: t.creditDebit === "CRDT" || t.creditDebit === "DBIT" ? t.creditDebit : undefined,
    description: optString(t.description) ?? "",
    status: optString(t.status) ?? "",
    categoryId: optNumber(t.categoryId),
    excludeFromCalculations: t.excludeFromCalculations === true,
    comment: optString(t.comment),
    to_bban: optString(t.to_bban),
    from_bban: optString(t.from_bban),
    raw: isRecord(t.raw) ? t.raw : {},
  };
}

function validateCursor(v: unknown, i: number): SyncCursor {
  const c = asRecord(v, `cursor[${i}]`);
  return {
    accountUid: reqString(c.accountUid, `cursor[${i}].accountUid`),
    lastBookingDate: optString(c.lastBookingDate) ?? "",
    updatedAt: optNumber(c.updatedAt) ?? 0,
  };
}

export function validateImportData(data: unknown): ImportData {
  const root = asRecord(data, "sikkerhetskopi");
  return {
    accounts: asArray(root.accounts ?? [], "accounts").map(validateAccount),
    transactions: asArray(root.transactions ?? [], "transactions").map(validateTransaction),
    cursors: asArray(root.cursors ?? [], "cursors").map(validateCursor),
    settings: root.settings !== undefined ? validateSyncedSettings(root.settings) : undefined,
  };
}

export function validateSyncedSettings(v: unknown): SyncedSettings {
  const s = asRecord(v, "settings");
  return {
    proxyUrl: reqString(s.proxyUrl, "settings.proxyUrl"),
    lookbackDays: optNumber(s.lookbackDays) ?? 90,
    backupMethod: optString(s.backupMethod) ?? "drive",
    driveAutosave: s.driveAutosave === true,
    usePassphrase: s.usePassphrase === true,
    dismissedPairs: Array.isArray(s.dismissedPairs)
      ? s.dismissedPairs.filter((x): x is string => typeof x === "string")
      : [],
  };
}
