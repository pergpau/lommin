import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { APP_NAME } from "../constants";
import { applySyncedSettings } from "./settings";
import { normalizeForMatch, type Account, type SyncCursor, type Transaction } from "./types";
import { validateImportData } from "./validate";

export type { Account, AccountSource, SyncCursor, Transaction } from "./types";

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
  _db = await openDB<LomminDB>(`${APP_NAME}-data`, 1, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("accounts", { keyPath: "uid" });
        const txStore = db.createObjectStore("transactions", { keyPath: "id" });
        txStore.createIndex("by-account", "accountUid");
        db.createObjectStore("syncCursors", { keyPath: "accountUid" });
      }
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
function txSoftKey(t: Transaction): string {
  const desc = t.matchDescription ?? normalizeForMatch(t.description);
  return `${t.accountUid}|${t.transactionDate}|${t.amount.toFixed(2)}|${desc}`;
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
        excludeFromCalculations: existing.excludeFromCalculations ?? false,
        customDate: existing.customDate,
        comment: existing.comment,
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
          excludeFromCalculations: softMatch.excludeFromCalculations ?? false,
          customDate: softMatch.customDate,
          comment: softMatch.comment,
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

async function patchTransactions(
  transactionIds: string[],
  patch: (t: Transaction) => Transaction,
): Promise<void> {
  if (transactionIds.length === 0) return;
  const d = await db();
  const tx = d.transaction("transactions", "readwrite");
  for (const id of transactionIds) {
    const t = await tx.store.get(id);
    if (t) await tx.store.put(patch(t));
  }
  await tx.done;
}

async function removeTransactions(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const d = await db();
  const tx = d.transaction("transactions", "readwrite");
  for (const id of transactionIds) await tx.store.delete(id);
  await tx.done;
}

export const setCategoryId = (transactionId: string, categoryId: number | undefined) =>
  patchTransactions([transactionId], (t) => ({ ...t, categoryId }));
export const batchSetCategoryId = (transactionIds: string[], categoryId: number | undefined) =>
  patchTransactions(transactionIds, (t) => ({ ...t, categoryId }));

export const setCustomDate = (transactionId: string, date: string | undefined) =>
  patchTransactions([transactionId], (t) => ({ ...t, customDate: date }));
export const batchSetCustomDate = (transactionIds: string[], date: string | undefined) =>
  patchTransactions(transactionIds, (t) => ({ ...t, customDate: date }));

export const setExcludeFromCalculations = (transactionId: string, value: boolean) =>
  patchTransactions([transactionId], (t) => ({ ...t, excludeFromCalculations: value }));
export const batchSetExcludeFromCalculations = (transactionIds: string[], value: boolean) =>
  patchTransactions(transactionIds, (t) => ({ ...t, excludeFromCalculations: value }));

export const setComment = (transactionId: string, comment: string | undefined) =>
  patchTransactions([transactionId], (t) => ({ ...t, comment: comment || undefined }));
export const batchSetComment = (transactionIds: string[], comment: string | undefined) =>
  patchTransactions(transactionIds, (t) => ({ ...t, comment: comment || undefined }));

export const deleteTransaction = (transactionId: string) => removeTransactions([transactionId]);
export const batchDeleteTransactions = (transactionIds: string[]) =>
  removeTransactions(transactionIds);

export async function disconnectAccount(uid: string): Promise<void> {
  const d = await db();
  const acc = await d.get("accounts", uid);
  if (!acc) return;
  await d.put("accounts", {
    ...acc,
    sources: acc.sources.filter((s) => s.type !== "enableBanking"),
  });
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

// Import (merge) from encrypted file or Spiir parser. Input is validated first.
// Pass overwrite:true for Drive pulls where the remote version is authoritative.
export async function importAll(
  data: unknown,
  options?: { overwrite?: boolean },
): Promise<{ inserted: number; skipped: number }> {
  const { accounts, transactions, cursors, settings } = validateImportData(data);
  const d = await db();

  if (options?.overwrite) {
    // Remote is authoritative: clear each store then repopulate in separate single-store
    // transactions to avoid IDB auto-committing a multi-store transaction between awaits.
    const atx = d.transaction("accounts", "readwrite");
    await atx.store.clear();
    for (const a of accounts) await atx.store.put(a);
    await atx.done;

    const ttx = d.transaction("transactions", "readwrite");
    await ttx.store.clear();
    for (const t of transactions) await ttx.store.put(t);
    await ttx.done;

    const ctx = d.transaction("syncCursors", "readwrite");
    await ctx.store.clear();
    for (const c of cursors) await ctx.store.put(c);
    await ctx.done;

    if (settings) await applySyncedSettings(settings);
    return { inserted: transactions.length, skipped: 0 };
  }

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

  if (settings) await applySyncedSettings(settings);
  return { inserted, skipped };
}
