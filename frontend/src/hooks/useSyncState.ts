import { useCallback, useState } from "react";
import i18n from "../lib/i18n";
import { ProxyNetworkError } from "../lib/enableBanking";
import { type Account } from "../lib/store";
import { syncAccounts } from "../lib/sync";

export function useSyncState() {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");
  const [failedAccounts, setFailedAccounts] = useState<Map<string, string>>(
    new Map(),
  );
  const [syncingAccountUids, setSyncingAccountUids] = useState<Set<string>>(
    new Set(),
  );

  const run = useCallback(
    async (accounts: Account[], onSuccess?: () => void, forcedDateFrom?: string) => {
      setSyncing(true);
      setSyncMsg("");
      setError("");
      setFailedAccounts(new Map());
      setSyncingAccountUids(new Set(accounts.map((a) => a.uid)));
      try {
        const { inserted, errors } = await syncAccounts(accounts, setSyncMsg, forcedDateFrom);
        setSyncingAccountUids(new Set());
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
        onSuccess?.();
      } catch (e) {
        const base = i18n.t("dashboard:snackbar.syncFailed");
        const detail = e instanceof ProxyNetworkError
          ? i18n.t("dashboard:snackbar.proxyUnreachable")
          : (e instanceof Error ? e.message : "");
        setError(detail ? `${base}: ${detail}` : base);
        setSyncMsg("");
        setSyncingAccountUids(new Set());
      } finally {
        setSyncing(false);
      }
    },
    [],
  );

  return { syncing, syncMsg, error, failedAccounts, syncingAccountUids, run };
}
