import { APP_NAME, SYNC_LOOKBACK_DAYS } from "../constants";

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
}

// Hosted HTTPS proxy. Override per deployment to match your own Worker; must also
// be reflected in the CSP connect-src (index.html / _headers).
export const HOSTED_PROXY_URL = "https://proxy.lommin.workers.dev";

const DEFAULTS: AppSettings = {
  proxyUrl: HOSTED_PROXY_URL,
  lookbackDays: SYNC_LOOKBACK_DAYS,
  usePassphrase: false,
  backupMethod: "file",
};

// Reject malformed/non-https proxy URLs at save time. The CSP connect-src blocks
// http: at request time anyway, but failing here gives the user a clear error
// instead of silently broken syncs later.
function validateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (key === "proxyUrl") {
    let u: URL;
    try {
      u = new URL(value as string);
    } catch {
      throw new Error("Ugyldig proxy-URL.");
    }
    if (u.protocol !== "https:") throw new Error("Proxy-URL må bruke https://.");
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
  const [proxyUrl, lookbackDays, usePassphrase, backupMethod] = await Promise.all([
    getSetting("proxyUrl"),
    getSetting("lookbackDays"),
    getSetting("usePassphrase"),
    getSetting("backupMethod"),
  ]);
  return { proxyUrl, lookbackDays, usePassphrase, backupMethod };
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
      if (!token || !expiry || Date.now() >= expiry) resolve(null);
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
