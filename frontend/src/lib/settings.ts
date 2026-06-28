import { APP_NAME, SYNC_LOOKBACK_DAYS } from "../constants";
import { type SyncedSettings } from "./validate";

const DB_NAME = `${APP_NAME}-settings`;
const DB_VERSION = 1;
const STORE = "settings";

export interface AppSettings {
  proxyUrl: string;
  // How far back the first sync of an account fetches (days). Subsequent syncs
  // continue from the stored cursor.
  lookbackDays: number;
  usePassphrase: boolean;
  backupMethod: "drive" | "file";
  driveAutosave: boolean;
  lastLocalSavedAt: number | null;
  lastDataModifiedAt: number | null;
}

export const DEFAULT_PROXY_URL = (import.meta.env.VITE_PROXY_URL as string) ?? "";

const DEFAULTS: AppSettings = {
  proxyUrl: DEFAULT_PROXY_URL,
  lookbackDays: SYNC_LOOKBACK_DAYS,
  usePassphrase: false,
  backupMethod: "file",
  driveAutosave: true,
  lastLocalSavedAt: null,
  lastDataModifiedAt: null,
};

// Reject malformed/non-https proxy URLs at save time. The CSP connect-src blocks
// http: at request time anyway, but failing here gives the user a clear error
// instead of silently broken syncs later.
function validateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (key === "proxyUrl") {
    const s = value as string;
    if (s !== "") {
      let u: URL;
      try {
        u = new URL(s);
      } catch {
        throw new Error("Ugyldig proxy-URL.");
      }
      if (u.protocol !== "https:") throw new Error("Proxy-URL må bruke https://.");
    }
  }
  if (key === "lookbackDays") {
    const n = value as number;
    if (!Number.isInteger(n) || n < 1 || n > 3650) {
      throw new Error("Antall dager må være et heltall mellom 1 og 3650.");
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "k" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function hasSetting(key: keyof AppSettings): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count(key);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () =>
      resolve((req.result !== undefined ? req.result.v : DEFAULTS[key]) as AppSettings[K]);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  validateSetting(key, value);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ k: key, v: value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSettings(): Promise<AppSettings> {
  const [proxyUrl, lookbackDays, usePassphrase, backupMethod, driveAutosave, lastLocalSavedAt, lastDataModifiedAt] = await Promise.all([
    getSetting("proxyUrl"),
    getSetting("lookbackDays"),
    getSetting("usePassphrase"),
    getSetting("backupMethod"),
    getSetting("driveAutosave"),
    getSetting("lastLocalSavedAt"),
    getSetting("lastDataModifiedAt"),
  ]);
  return { proxyUrl, lookbackDays, usePassphrase, backupMethod, driveAutosave, lastLocalSavedAt, lastDataModifiedAt };
}

export async function getDriveToken(): Promise<{ token: string; expiry: number } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    let token: string | undefined;
    let expiry: number | undefined;
    const r1 = tx.objectStore(STORE).get("driveAccessToken");
    const r2 = tx.objectStore(STORE).get("driveTokenExpiry");
    r1.onsuccess = () => { token = r1.result?.v as string | undefined; };
    r2.onsuccess = () => { expiry = r2.result?.v as number | undefined; };
    tx.oncomplete = () => {
      if (!token || !expiry || Date.now() >= expiry - 60_000) resolve(null);
      else resolve({ token, expiry });
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function persistDriveToken(token: string, expiresIn: number): Promise<void> {
  const expiry = Date.now() + expiresIn * 1000;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ k: "driveAccessToken", v: token });
    tx.objectStore(STORE).put({ k: "driveTokenExpiry", v: expiry });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDismissedPairs(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get("dismissedDuplicatePairs");
    req.onsuccess = () => resolve((req.result?.v as string[] | undefined) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function addDismissedPair(key: string): Promise<void> {
  const existing = await getDismissedPairs();
  if (existing.includes(key)) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ k: "dismissedDuplicatePairs", v: [...existing, key] });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dismissAllPairs(keys: string[]): Promise<void> {
  const existing = await getDismissedPairs();
  const merged = Array.from(new Set([...existing, ...keys]));
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ k: "dismissedDuplicatePairs", v: merged });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearDismissedPairs(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete("dismissedDuplicatePairs");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncedSettings(): Promise<SyncedSettings> {
  const [settings, dismissedPairs] = await Promise.all([getAllSettings(), getDismissedPairs()]);
  return {
    proxyUrl: settings.proxyUrl,
    lookbackDays: settings.lookbackDays,
    backupMethod: settings.backupMethod,
    driveAutosave: settings.driveAutosave,
    usePassphrase: settings.usePassphrase,
    dismissedPairs,
  };
}

export async function applySyncedSettings(s: SyncedSettings): Promise<void> {
  await Promise.all([
    setSetting("proxyUrl", s.proxyUrl),
    setSetting("lookbackDays", s.lookbackDays),
    setSetting("backupMethod", s.backupMethod as "drive" | "file"),
    setSetting("driveAutosave", s.driveAutosave),
    setSetting("usePassphrase", s.usePassphrase),
    dismissAllPairs(s.dismissedPairs),
  ]);
}

export async function hasDriveTokenStored(): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count("driveAccessToken");
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

export async function clearDriveToken(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete("driveAccessToken");
    tx.objectStore(STORE).delete("driveTokenExpiry");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLastBackupHash(): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get("lastBackupHash");
    req.onsuccess = () => resolve((req.result?.v as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setLastBackupHash(hash: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ k: "lastBackupHash", v: hash });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
