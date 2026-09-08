import { useCallback, useEffect, useRef, useState } from "react";
import type { Account } from "../lib/data";
import { ProxyNetworkError } from "../lib/enableBanking";
import i18n from "../lib/i18n";
import { syncAccounts } from "../lib/sync";

export const NEW_HIGHLIGHT_MS = 10_000;

export interface NewTransactions {
  ids: Set<string>;
  at: number;
}

const EMPTY_NEW: NewTransactions = { ids: new Set(), at: 0 };

export function useSyncState() {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");
  const [failedAccounts, setFailedAccounts] = useState<Map<string, string>>(new Map());
  const [sessionExpiredUids, setSessionExpiredUids] = useState<Set<string>>(new Set());
  const [syncingAccountUids, setSyncingAccountUids] = useState<Set<string>>(new Set());
  // Transactions inserted by the latest sync, kept for NEW_HIGHLIGHT_MS so rows can be
  // highlighted. `at` anchors the fade so rows that mount late join it mid-way.
  const [newTx, setNewTx] = useState<NewTransactions>(EMPTY_NEW);
  const newTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (newTimer.current) clearTimeout(newTimer.current);
    },
    [],
  );

  const run = useCallback(
    async (
      accounts: Account[],
      onSuccess?: (hadErrors: boolean) => void,
      forcedDateFrom?: string,
    ) => {
      setSyncing(true);
      setSyncProgress("");
      setSyncMsg("");
      setError("");
      setFailedAccounts(new Map());
      setSessionExpiredUids(new Set());
      setSyncingAccountUids(new Set(accounts.map((a) => a.uid)));
      try {
        const { insertedIds, errors } = await syncAccounts(
          accounts,
          setSyncProgress,
          forcedDateFrom,
        );
        setSyncingAccountUids(new Set());
        setSyncProgress("");
        setSyncMsg(i18n.t("dashboard:snackbar.syncResult", { count: insertedIds.length }));
        setNewTx({ ids: new Set(insertedIds), at: Date.now() });
        if (newTimer.current) clearTimeout(newTimer.current);
        newTimer.current = setTimeout(() => setNewTx(EMPTY_NEW), NEW_HIGHLIGHT_MS);
        if (errors.length > 0) {
          setFailedAccounts(
            new Map(
              errors.map((e) => [
                e.uid,
                e.isNetworkError
                  ? i18n.t("dashboard:snackbar.proxyUnreachable")
                  : e.isSessionExpired
                    ? i18n.t("dashboard:snackbar.sessionExpired")
                    : e.message,
              ]),
            ),
          );
          setSessionExpiredUids(
            new Set(errors.filter((e) => e.isSessionExpired).map((e) => e.uid)),
          );
        }
        onSuccess?.(errors.length > 0);
      } catch (e) {
        const base = i18n.t("dashboard:snackbar.syncFailed");
        const detail =
          e instanceof ProxyNetworkError
            ? i18n.t("dashboard:snackbar.proxyUnreachable")
            : e instanceof Error
              ? e.message
              : "";
        setError(detail ? `${base}: ${detail}` : base);
        setSyncProgress("");
        setSyncMsg("");
        setSyncingAccountUids(new Set());
      } finally {
        setSyncing(false);
      }
    },
    [],
  );

  return {
    syncing,
    syncProgress,
    syncMsg,
    error,
    failedAccounts,
    sessionExpiredUids,
    syncingAccountUids,
    newTx,
    run,
  };
}
