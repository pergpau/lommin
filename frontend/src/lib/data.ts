// Public data interface. All writes trigger autosave (debounced 3 s).
// Import data operations from here, not from store.ts directly.
// Exception: autosave.ts imports exportAll from store to avoid a circular dependency.

import { triggerAutosave } from "./autosave";
import { setSetting } from "./settings";
import * as store from "./store";

export type { Account, AccountSource, SyncCursor, Transaction } from "./types";
export { getEnableBankingSource, makeTransactionId, normalizeForMatch } from "./types";

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => void triggerAutosave(), 3000);
}

function markAndSchedule(): void {
  void setSetting("lastDataModifiedAt", Date.now());
  scheduleAutosave();
}

function wrap<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const result = await fn(...args);
    markAndSchedule();
    return result;
  };
}

// Writes
export const setCategoryId = wrap(store.setCategoryId);
export const setExcludeFromCalculations = wrap(store.setExcludeFromCalculations);
export const setCustomDate = wrap(store.setCustomDate);
export const setComment = wrap(store.setComment);
export const deleteTransaction = wrap(store.deleteTransaction);
export const deleteAccount = wrap(store.deleteAccount);
export const disconnectAccount = wrap(store.disconnectAccount);
export const resetAccountSync = wrap(store.resetAccountSync);
export const saveAccount = wrap(store.saveAccount);
export const upsertTransactions = wrap(store.upsertTransactions);
export const tagTransferCategory = wrap(store.tagTransferCategory);
export const clearAccounts = wrap(store.clearAccounts);
export const clearTransactions = wrap(store.clearTransactions);
export const setSyncCursor = wrap(store.setSyncCursor);

// importAll: skip autosave when overwrite is true (Drive pull) to avoid push-back loop.
export async function importAll(
  data: unknown,
  options?: { overwrite?: boolean },
): Promise<{ inserted: number; skipped: number }> {
  const result = await store.importAll(data, options);
  if (!options?.overwrite) markAndSchedule();
  return result;
}

// Reads
export const getAccounts = store.getAccounts;
export const getAllTransactions = store.getAllTransactions;
export const getTransactionsForAccount = store.getTransactionsForAccount;
export const getSyncCursor = store.getSyncCursor;
export const exportAll = store.exportAll;
export { validateImportData } from "./validate";
