// Wrappers around store mutations that automatically trigger autosave.
// Import from here instead of store.ts for any operation that modifies user data.
// sync.ts is the exception — it batches many writes and triggers autosave via its callback.

import { triggerAutosave } from "./autosave";
import * as store from "./store";

export type { Account, Transaction } from "./store";

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => void triggerAutosave(), 3000);
}

function wrap<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const result = await fn(...args);
    scheduleAutosave();
    return result;
  };
}

export const setCategoryId = wrap(store.setCategoryId);
export const setExcludeFromCalculations = wrap(store.setExcludeFromCalculations);
export const setCustomDate = wrap(store.setCustomDate);
export const setComment = wrap(store.setComment);
export const deleteTransaction = wrap(store.deleteTransaction);
export const deleteAccount = wrap(store.deleteAccount);
export const disconnectAccount = wrap(store.disconnectAccount);
export const resetAccountSync = wrap(store.resetAccountSync);
export const saveAccount = wrap(store.saveAccount);
export const importAll = wrap(store.importAll);
