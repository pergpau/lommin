import { DriveAuthError, saveBackupToDrive } from "./googleDrive";
import { clearDriveToken, getAllSettings, getDriveToken, getLastBackupHash, getSyncedSettings, setLastBackupHash, setSetting } from "./settings";
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

    const [data, settings] = await Promise.all([exportAll(), getSyncedSettings()]);
    const payload = { ...data, settings };
    const json = JSON.stringify(payload);
    const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
    const hash = Array.from(new Uint8Array(hashBytes), (b) => b.toString(16).padStart(2, "0")).join("");
    const prev = await getLastBackupHash();
    if (hash === prev) return;

    _listeners.forEach((cb) => cb(true));
    try {
      const savedAt = await saveBackupToDrive(stored.token, payload, "");
      await Promise.all([setSetting("lastLocalSavedAt", savedAt), setLastBackupHash(hash)]);
    } finally {
      _listeners.forEach((cb) => cb(false));
    }
  } catch (e) {
    if (e instanceof DriveAuthError) {
      void clearDriveToken();
      window.dispatchEvent(new Event("lommin:drive-auth-expired"));
    }
    console.warn("Autosave to Drive failed:", e);
  }
}
