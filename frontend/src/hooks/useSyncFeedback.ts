import { useCallback, useEffect, useRef } from "react";
import { useSnackbar } from "../components/ui/Snackbar";
import { triggerAutosave } from "../lib/backup";
import type { Account } from "../lib/data";
import { useSuccessFlash } from "./useSuccessFlash";
import { useSyncState } from "./useSyncState";

interface Options {
  // Called after every sync attempt so the page can reload its data.
  onSynced: () => void;
  // When set, only this account's failure is surfaced in the snackbar;
  // otherwise the first failure is.
  accountUid?: string;
}

interface SyncExtras {
  dateFrom?: string;
  // Runs only when the sync finished without errors.
  onSuccess?: () => void;
}

// useSyncState plus the page-level plumbing every sync button needs: progress
// and result snackbars, the success flash, and the reload + autosave that
// follow a sync.
export function useSyncFeedback({ onSynced, accountUid }: Options) {
  const state = useSyncState();
  const { syncProgress, syncMsg, error, failedAccounts, run } = state;
  const { showSnackbar } = useSnackbar();
  const { success: syncSuccess, flash } = useSuccessFlash();
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    if (syncProgress) showSnackbar(syncProgress, "info", null);
  }, [syncProgress, showSnackbar]);

  useEffect(() => {
    if (syncMsg) showSnackbar(syncMsg, "ok");
  }, [syncMsg, showSnackbar]);

  useEffect(() => {
    if (error) showSnackbar(error, "error");
  }, [error, showSnackbar]);

  useEffect(() => {
    const msg = accountUid ? failedAccounts.get(accountUid) : [...failedAccounts.values()][0];
    if (msg) showSnackbar(msg, "error");
  }, [failedAccounts, accountUid, showSnackbar]);

  const sync = useCallback(
    (accounts: Account[], extras?: SyncExtras) =>
      run(
        accounts,
        (hadErrors) => {
          onSyncedRef.current();
          if (!hadErrors) {
            void triggerAutosave();
            flash();
            extras?.onSuccess?.();
          }
        },
        extras?.dateFrom,
      ),
    [run, flash],
  );

  return { ...state, syncSuccess, sync };
}
