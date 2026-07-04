import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "../components/ui/Snackbar";
import {
  applyRestore,
  assessDriveSync,
  BackupError,
  loadBackup,
  type RestorePlan,
  triggerAutosave,
} from "../lib/backup";

export function useDriveSync() {
  const { showSnackbar, hideSnackbar } = useSnackbar();
  const { t } = useTranslation("common");
  const inFlight = useRef(false);
  const [pendingRestore, setPendingRestore] = useState<RestorePlan | null>(null);
  const pendingRef = useRef<RestorePlan | null>(null);
  pendingRef.current = pendingRestore;
  const declinedDriveVersion = useRef<number | null>(null);

  const restoreNow = useCallback(
    async (plan: RestorePlan) => {
      await applyRestore(plan, { mode: "overwrite" });
      showSnackbar(t("sync.done"), "ok");
    },
    [showSnackbar, t],
  );

  const attemptSync = useCallback(async () => {
    if (window.opener) return;
    if (inFlight.current || pendingRef.current) return;
    inFlight.current = true;

    try {
      const assessment = await assessDriveSync();
      if (assessment.action === "push") {
        void triggerAutosave();
        return;
      }
      if (assessment.action !== "pull") return;
      if (declinedDriveVersion.current === assessment.driveModifiedAt) return;

      showSnackbar(t("sync.syncing"), "info", null);
      const plan = await loadBackup("", { source: "drive" });

      if (plan.warnFewerTransactions) {
        hideSnackbar();
        setPendingRestore(plan);
        return;
      }

      await restoreNow(plan);
    } catch (e) {
      // drive-auth: the backup module already cleared the token and fired
      // the reconnect event; the reconnect modal takes it from here.
      if (!(e instanceof BackupError && e.kind === "drive-auth")) {
        showSnackbar(t("sync.error"), "error");
      }
    } finally {
      inFlight.current = false;
    }
  }, [showSnackbar, hideSnackbar, t, restoreNow]);

  const confirmRestore = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    setPendingRestore(null);
    showSnackbar(t("sync.syncing"), "info", null);
    try {
      await restoreNow(pending);
    } catch {
      showSnackbar(t("sync.error"), "error");
    }
  }, [restoreNow, showSnackbar, t]);

  const dismissRestore = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) declinedDriveVersion.current = pending.backupSavedAt;
    setPendingRestore(null);
  }, []);

  useEffect(() => {
    void attemptSync();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void attemptSync();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("lommin:drive-token-updated", attemptSync);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("lommin:drive-token-updated", attemptSync);
    };
  }, [attemptSync]);

  return { pendingRestore, confirmRestore, dismissRestore };
}
