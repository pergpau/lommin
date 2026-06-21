import { useCallback, useState } from "react";
import { ProxyNetworkError } from "../lib/enableBanking";
import i18n from "../lib/i18n";
import { type Account } from "../lib/store";
import { syncAccounts } from "../lib/sync";

export function useSyncState() {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");
  const [failedAccounts, setFailedAccounts] = useState<Map<string, string>>(
    new Map(),
  );
  const [syncingAccountUids, setSyncingAccountUids] = useState<Set<string>>(
    new Set(),
  );

  const run = useCallback(
    async (accounts: Account[], onSuccess?: (hadErrors: boolean) => void, forcedDateFrom?: string) => {
      setSyncing(true);
      setSyncProgress("");
      setSyncMsg("");
      setError("");
      setFailedAccounts(new Map());
      setSyncingAccountUids(new Set(accounts.map((a) => a.uid)));
      try {
        const { inserted, errors } = await syncAccounts(accounts, setSyncProgress, forcedDateFrom);
        setSyncingAccountUids(new Set());
        setSyncProgress("");
        setSyncMsg(
          i18n.t("dashboard:snackbar.syncResult", { count: inserted }),
        );
        if (errors.length > 0) {
          setFailedAccounts(
            new Map(
              errors.map((e) => [
                e.uid,
                e.isNetworkError
                  ? i18n.t("dashboard:snackbar.proxyUnreachable")
                  : e.message,
              ]),
            ),
          );
        }
        onSuccess?.(errors.length > 0);
      } catch (e) {
        const base = i18n.t("dashboard:snackbar.syncFailed");
        const detail = e instanceof ProxyNetworkError
          ? i18n.t("dashboard:snackbar.proxyUnreachable")
          : (e instanceof Error ? e.message : "");
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

  return { syncing, syncProgress, syncMsg, error, failedAccounts, syncingAccountUids, run };
}
