import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "../components/ui/Snackbar";
import { triggerAutosave } from "../lib/autosave";
import { DriveAuthError, getDriveBackupModifiedTime, loadBackupFromDrive } from "../lib/googleDrive";
import { clearDriveToken, getAllSettings, getDriveToken, hasDriveTokenStored, setSetting } from "../lib/settings";
import { getAllTransactions, importAll } from "../lib/data";

export type PendingDriveRestore = {
  data: object;
  driveModifiedAt: number;
  backupCount: number;
  localCount: number;
};

export function useDriveSync() {
  const { showSnackbar, hideSnackbar } = useSnackbar();
  const { t } = useTranslation("common");
  const inFlight = useRef(false);
  const [pendingRestore, setPendingRestore] = useState<PendingDriveRestore | null>(null);
  const pendingRef = useRef<PendingDriveRestore | null>(null);
  pendingRef.current = pendingRestore;
  const declinedDriveVersion = useRef<number | null>(null);

  const applyRestore = useCallback(async (data: object, driveModifiedAt: number) => {
    await importAll(data, { overwrite: true });
    await setSetting("lastLocalSavedAt", driveModifiedAt);
    await setSetting("lastDataModifiedAt", driveModifiedAt);
    window.dispatchEvent(new Event("lommin:data-reload"));
    showSnackbar(t("sync.done"), "ok");
  }, [showSnackbar, t]);

  const attemptSync = useCallback(async () => {
    if (window.opener) return;
    if (inFlight.current || pendingRef.current) return;
    inFlight.current = true;

    try {
      const [settings, stored] = await Promise.all([getAllSettings(), getDriveToken()]);
      if (!settings.driveAutosave || settings.backupMethod !== "drive" || settings.usePassphrase) return;
      if (!stored) {
        const hadToken = await hasDriveTokenStored();
        if (hadToken) window.dispatchEvent(new Event("lommin:drive-auth-expired"));
        return;
      }

      const hasUnsavedLocalChanges = settings.lastDataModifiedAt !== null
        && (settings.lastLocalSavedAt === null || settings.lastDataModifiedAt > settings.lastLocalSavedAt);

      if (hasUnsavedLocalChanges) {
        void triggerAutosave();
        return;
      }

      const driveModifiedAt = await getDriveBackupModifiedTime(stored.token);
      if (!driveModifiedAt) return;
      if (settings.lastLocalSavedAt !== null && driveModifiedAt <= settings.lastLocalSavedAt) return;
      if (declinedDriveVersion.current === driveModifiedAt) return;

      showSnackbar(t("sync.syncing"), "info", null);
      const data = await loadBackupFromDrive(stored.token, "");
      const raw = data as { transactions?: unknown[] };
      const backupCount = Array.isArray(raw.transactions) ? raw.transactions.length : 0;
      const localCount = (await getAllTransactions()).length;

      if (backupCount < localCount) {
        hideSnackbar();
        setPendingRestore({ data, driveModifiedAt, backupCount, localCount });
        return;
      }

      await applyRestore(data, driveModifiedAt);
    } catch (e) {
      if (e instanceof DriveAuthError) {
        void clearDriveToken();
        window.dispatchEvent(new Event("lommin:drive-auth-expired"));
      } else {
        showSnackbar(t("sync.error"), "error");
      }
    } finally {
      inFlight.current = false;
    }
  }, [showSnackbar, hideSnackbar, t, applyRestore]);

  const confirmRestore = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    setPendingRestore(null);
    showSnackbar(t("sync.syncing"), "info", null);
    try {
      await applyRestore(pending.data, pending.driveModifiedAt);
    } catch {
      showSnackbar(t("sync.error"), "error");
    }
  }, [applyRestore, showSnackbar, t]);

  const dismissRestore = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) declinedDriveVersion.current = pending.driveModifiedAt;
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
