import { DriveAuthError, saveBackupToDrive } from "./googleDrive";
import { clearDriveToken, getAllSettings, getDriveToken, setSetting } from "./settings";
import { exportAll } from "./store";

export async function triggerAutosave(): Promise<void> {
  try {
    const { driveAutosave, backupMethod, usePassphrase } = await getAllSettings();
    if (!driveAutosave || backupMethod !== "drive" || usePassphrase) return;

    const stored = await getDriveToken();
    if (!stored) return;

    const data = await exportAll();
    await saveBackupToDrive(stored.token, data, "");
    await setSetting("lastLocalSavedAt", Date.now());
  } catch (e) {
    if (e instanceof DriveAuthError) {
      void clearDriveToken();
    }
    console.warn("Autosave to Drive failed:", e);
  }
}
