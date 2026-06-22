import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "../components/ui/Snackbar";
import { triggerAutosave } from "../lib/autosave";
import { DriveAuthError, getDriveBackupModifiedTime, loadBackupFromDrive } from "../lib/googleDrive";
import { clearDriveToken, getAllSettings, getDriveToken, setSetting } from "../lib/settings";
import { importAll } from "../lib/store";

export function useDriveSync() {
  const { showSnackbar } = useSnackbar();
  const { t } = useTranslation("common");
  const inFlight = useRef(false);

  const attemptSync = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const [settings, stored] = await Promise.all([getAllSettings(), getDriveToken()]);
      if (!settings.driveAutosave || settings.backupMethod !== "drive" || settings.usePassphrase) return;
      if (!stored) return;

      const hasUnsavedLocalChanges = settings.lastDataModifiedAt !== null
        && (settings.lastLocalSavedAt === null || settings.lastDataModifiedAt > settings.lastLocalSavedAt);

      if (hasUnsavedLocalChanges) {
        void triggerAutosave();
        return;
      }

      const driveModifiedAt = await getDriveBackupModifiedTime(stored.token);
      if (!driveModifiedAt) return;
      if (settings.lastLocalSavedAt !== null && driveModifiedAt <= settings.lastLocalSavedAt) return;

      showSnackbar(t("sync.syncing"), "info", null);
      const data = await loadBackupFromDrive(stored.token, "");
      await importAll(data);
      const now = Date.now();
      await setSetting("lastLocalSavedAt", driveModifiedAt);
      await setSetting("lastDataModifiedAt", now);
      window.dispatchEvent(new Event("lommin:data-reload"));
      showSnackbar(t("sync.done"), "ok");
    } catch (e) {
      if (e instanceof DriveAuthError) {
        void clearDriveToken();
      } else {
        showSnackbar(t("sync.error"), "error");
      }
    } finally {
      inFlight.current = false;
    }
  }, [showSnackbar, t]);

  useEffect(() => {
    void attemptSync();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void attemptSync();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [attemptSync]);
}
