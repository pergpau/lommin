import { DriveAuthError, saveBackupToDrive } from "./googleDrive";
import { clearDriveToken, getAllSettings, getDriveToken, getSyncedSettings, setSetting } from "./settings";
import { exportAll } from "./store";

type SaveListener = (saving: boolean) => void;
const _listeners = new Set<SaveListener>();

export function addSaveListener(cb: SaveListener): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

export async function triggerAutosave(): Promise<void> {
  try {
    const { driveAutosave, backupMethod, usePassphrase } = await getAllSettings();
    if (!driveAutosave || backupMethod !== "drive" || usePassphrase) return;

    const stored = await getDriveToken();
    if (!stored) return;

    _listeners.forEach((cb) => cb(true));
    try {
      const [data, settings] = await Promise.all([exportAll(), getSyncedSettings()]);
      await saveBackupToDrive(stored.token, { ...data, settings }, "");
      await setSetting("lastLocalSavedAt", Date.now());
    } finally {
      _listeners.forEach((cb) => cb(false));
    }
  } catch (e) {
    if (e instanceof DriveAuthError) {
      void clearDriveToken();
    }
    console.warn("Autosave to Drive failed:", e);
  }
}
