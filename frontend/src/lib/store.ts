import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { APP_NAME } from "../constants";
import {
  asArray,
  asRecord,
  isRecord,
  optNumber,
  optString,
  reqString,
  ValidationError,
} from "./validate";

export interface AccountSource {
  type: "enableBanking" | "spiir" | "demo";
  sourceId: string; // Enable Banking account UID or Spiir accountId
  sessionId?: string; // Enable Banking session ID
}

export interface Account {
  uid: string; // Internal UUID — never an external API ID
  name?: string;
  bankName?: string;
  bankCountry?: string;
  currency?: string;
  iban?: string;
  bban?: string;
  identificationHash?: string;
  identificationHashes?: string[];
  addedAt: number;
  balance?: number;
  balanceFetchedAt?: number;
  sources: AccountSource[];
}

export function getEnableBankingSource(acc: Account): AccountSource | undefined {
  return acc.sources.find((s) => s.type === "enableBanking");
}

export interface Transaction {
  id: string; // composite: `${account_uid}::${entry_reference}`
  accountUid: string;
  entryReference: string;
  bookingDate: string;
  transactionDate: string;
  customDate?: string;
  amount: number;
  currency: string;
  creditDebit?: "CRDT" | "DBIT";
  description: string;
  bankTransactionCode?: string;
  status: string;
  categoryId?: number;
  isExtraordinary: boolean;
  to_bban?: string;
  from_bban?: string;
  raw: Record<string, unknown>;
}

export interface SyncCursor {
  accountUid: string;
  lastBookingDate: string;
  updatedAt: number;
}

interface LomminDB extends DBSchema {
  accounts: { key: string; value: Account };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { "by-account": string };
  };
  syncCursors: { key: string; value: SyncCursor };
}

let _db: IDBPDatabase<LomminDB> | null = null;

async function db(): Promise<IDBPDatabase<LomminDB>> {
  if (_db) return _db;
  // v0: no migrations. Until a v1 schema is declared, breaking changes are
  // handled by wiping all data and re-inserting, so the upgrade hook just
  // creates the stores from scratch.
  _db = await openDB<LomminDB>(`${APP_NAME}-data`, 1, {
    upgrade(db) {
      db.createObjectStore("accounts", { keyPath: "uid" });
      const txStore = db.createObjectStore("transactions", { keyPath: "id" });
      txStore.createIndex("by-account", "accountUid");
      db.createObjectStore("syncCursors", { keyPath: "accountUid" });
    },
    blocked() {
      window.location.reload();
    },
    blocking() {
      _db?.close();
      _db = null;
    },
  });
  return _db;
}

// Accounts
export async function saveAccount(acc: Account): Promise<void> {
  const d = await db();
  await d.put("accounts", acc);
}

export async function getAccounts(): Promise<Account[]> {
  return (await db()).getAll("accounts");
}

export async function deleteAccount(uid: string): Promise<void> {
  const d = await db();
  const atx = d.transaction("accounts", "readwrite");
  await atx.store.delete(uid);
  await atx.done;
  const ttx = d.transaction("transactions", "readwrite");
  const keys = await ttx.store.index("by-account").getAllKeys(uid);
  for (const k of keys) await ttx.store.delete(k);
  await ttx.done;
  const ctx = d.transaction("syncCursors", "readwrite");
  await ctx.store.delete(uid);
  await ctx.done;
}

export async function clearAccounts(): Promise<void> {
  const d = await db();
  const tx = d.transaction("accounts", "readwrite");
  await tx.store.clear();
  await tx.done;
}

// Transactions
export function makeTransactionId(accountUid: string, entryReference: string): string {
  return `${accountUid}::${entryReference}`;
}

function txSoftKey(t: Transaction): string {
  return `${t.accountUid}|${t.bookingDate}|${t.amount.toFixed(2)}|${t.description.toLowerCase()}`;
}

export async function upsertTransactions(txns: Transaction[]): Promise<number> {
  if (txns.length === 0) return 0;
  const d = await db();

  // Build a cross-source dedup index: soft-key → existing transaction ID.
  // Catches the same transaction imported from both Spiir and Enable Banking,
  // which arrive with different IDs but matching date/amount/description (modulo casing).
  const affectedUids = [...new Set(txns.map((t) => t.accountUid))];
  const softKeyIndex = new Map<string, string>();
  for (const uid of affectedUids) {
    for (const t of await d.getAllFromIndex("transactions", "by-account", uid)) {
      const k = txSoftKey(t);
      if (!softKeyIndex.has(k)) softKeyIndex.set(k, t.id);
    }
  }

  let inserted = 0;
  const tx = d.transaction("transactions", "readwrite");
  for (const t of txns) {
    const existing = await tx.store.get(t.id);
    if (existing) {
      await tx.store.put({
        ...t,
        categoryId: existing.categoryId,
        isExtraordinary: existing.isExtraordinary ?? false,
        customDate: existing.customDate,
      });
    } else {
      const softMatchId = softKeyIndex.get(txSoftKey(t));
      const softMatch = softMatchId ? await tx.store.get(softMatchId) : undefined;
      if (softMatch) {
        // Merge into the existing record: new description wins, user annotations preserved.
        await tx.store.put({
          ...t,
          id: softMatch.id,
          entryReference: softMatch.entryReference,
          categoryId: softMatch.categoryId,
          isExtraordinary: softMatch.isExtraordinary ?? false,
          customDate: softMatch.customDate,
        });
      } else {
        inserted++;
        await tx.store.put(t);
      }
    }
  }
  await tx.done;
  return inserted;
}

export async function getTransactionsForAccount(accountUid: string): Promise<Transaction[]> {
  const d = await db();
  return d.getAllFromIndex("transactions", "by-account", accountUid);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  return (await db()).getAll("transactions");
}

export async function tagTransferCategory(transferIds: Set<string>): Promise<void> {
  const d = await db();
  const all = await d.getAll("transactions");
  const tx = d.transaction("transactions", "readwrite");
  for (const t of all) {
    if (transferIds.has(t.id) && t.categoryId === undefined) {
      await tx.store.put({ ...t, categoryId: 100 });
    }
  }
  await tx.done;
}

export async function setCategoryId(
  transactionId: string,
  categoryId: number | undefined,
): Promise<void> {
  const d = await db();
  const tx = d.transaction("transactions", "readwrite");
  const t = await tx.store.get(transactionId);
  if (t) await tx.store.put({ ...t, categoryId });
  await tx.done;
}

export async function setCustomDate(
  transactionId: string,
  date: string | undefined,
): Promise<void> {
  const d = await db();
  const tx = d.transaction("transactions", "readwrite");
  const t = await tx.store.get(transactionId);
  if (t) await tx.store.put({ ...t, customDate: date });
  await tx.done;
}

export async function setIsExtraordinary(
  transactionId: string,
  value: boolean,
): Promise<void> {
  const d = await db();
  const tx = d.transaction("transactions", "readwrite");
  const t = await tx.store.get(transactionId);
  if (t) await tx.store.put({ ...t, isExtraordinary: value });
  await tx.done;
}

// Remove the enableBanking source from an account so it's no longer synced via API.
export async function deleteTransaction(transactionId: string): Promise<void> {
  const d = await db();
  await d.delete("transactions", transactionId);
}

export async function disconnectAccount(uid: string): Promise<void> {
  const d = await db();
  const acc = await d.get("accounts", uid);
  if (!acc) return;
  await d.put("accounts", { ...acc, sources: acc.sources.filter((s) => s.type !== "enableBanking") });
  const ctx = d.transaction("syncCursors", "readwrite");
  await ctx.store.delete(uid);
  await ctx.done;
}

// Wipe transactions and cursor for one account so the next sync refetches from scratch.
export async function resetAccountSync(accountUid: string): Promise<void> {
  const d = await db();
  const ttx = d.transaction("transactions", "readwrite");
  const keys = await ttx.store.index("by-account").getAllKeys(accountUid);
  for (const k of keys) await ttx.store.delete(k);
  await ttx.done;
  const ctx = d.transaction("syncCursors", "readwrite");
  await ctx.store.delete(accountUid);
  await ctx.done;
}

// Wipe all stored transactions and sync cursors so the next sync refetches
// everything from scratch (e.g. after a parsing change).
export async function clearTransactions(): Promise<void> {
  const d = await db();
  const tx = d.transaction(["transactions", "syncCursors"], "readwrite");
  await tx.objectStore("transactions").clear();
  await tx.objectStore("syncCursors").clear();
  await tx.done;
}

// Sync cursors
export async function getSyncCursor(accountUid: string): Promise<SyncCursor | undefined> {
  return (await db()).get("syncCursors", accountUid);
}

export async function setSyncCursor(accountUid: string, lastBookingDate: string): Promise<void> {
  const d = await db();
  await d.put("syncCursors", {
    accountUid,
    lastBookingDate,
    updatedAt: Date.now(),
  });
}

// Export all data (for encrypted sync)
export async function exportAll(): Promise<object> {
  const d = await db();
  const [accounts, transactions, cursors] = await Promise.all([
    d.getAll("accounts"),
    d.getAll("transactions"),
    d.getAll("syncCursors"),
  ]);
  return { accounts, transactions, cursors, exportedAt: Date.now() };
}

interface ImportData {
  accounts: Account[];
  transactions: Transaction[];
  cursors: SyncCursor[];
}

function validateAccountSource(v: unknown, where: string): AccountSource {
  const s = asRecord(v, where);
  if (s.type !== "enableBanking" && s.type !== "spiir" && s.type !== "demo") {
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
    isExtraordinary: t.isExtraordinary === true,
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

// Validate untrusted import data (decrypted backup file or built Spiir payload)
// before it touches IndexedDB. Throws ValidationError on malformed input rather
// than persisting corrupt records.
export function validateImportData(data: unknown): ImportData {
  const root = asRecord(data, "sikkerhetskopi");
  return {
    accounts: asArray(root.accounts ?? [], "accounts").map(validateAccount),
    transactions: asArray(root.transactions ?? [], "transactions").map(validateTransaction),
    cursors: asArray(root.cursors ?? [], "cursors").map(validateCursor),
  };
}

// Import (merge) from encrypted file or Spiir parser. Input is validated first.
export async function importAll(data: unknown): Promise<{ inserted: number; skipped: number }> {
  const { accounts, transactions, cursors } = validateImportData(data);
  const d = await db();
  const atx = d.transaction("accounts", "readwrite");
  for (const a of accounts) await atx.store.put(a);
  await atx.done;

  let inserted = 0;
  let skipped = 0;
  const ttx = d.transaction("transactions", "readwrite");
  for (const t of transactions) {
    const existing = await ttx.store.get(t.id);
    if (!existing) {
      await ttx.store.put(t);
      inserted++;
    } else {
      skipped++;
    }
  }
  await ttx.done;

  const ctx = d.transaction("syncCursors", "readwrite");
  for (const c of cursors) {
    const existing = await ctx.store.get(c.accountUid);
    if (!existing || c.updatedAt > existing.updatedAt) await ctx.store.put(c);
  }
  await ctx.done;

  return { inserted, skipped };
}
