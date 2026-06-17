import { useCallback, useState } from "react";
import i18n from "../lib/i18n";
import { type Account } from "../lib/store";
import { syncAccounts } from "../lib/sync";

export function useSyncState() {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");
  const [failedAccounts, setFailedAccounts] = useState<Map<string, string>>(new Map());
  const [syncingAccountUids, setSyncingAccountUids] = useState<Set<string>>(new Set());

  const run = useCallback(async (accounts: Account[], onSuccess?: () => void) => {
    setSyncing(true);
    setSyncMsg("");
    setError("");
    setFailedAccounts(new Map());
    setSyncingAccountUids(new Set(accounts.map((a) => a.uid)));
    try {
      const { inserted, errors } = await syncAccounts(accounts, setSyncMsg);
      setSyncingAccountUids(new Set());
      setSyncMsg(i18n.t("dashboard:snackbar.syncResult", { count: inserted }));
      if (errors.length > 0) {
        setFailedAccounts(new Map(errors.map((e) => [e.uid, e.message])));
      }
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : i18n.t("dashboard:snackbar.syncFailed"));
      setSyncMsg("");
      setSyncingAccountUids(new Set());
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, syncMsg, error, failedAccounts, syncingAccountUids, run };
}
