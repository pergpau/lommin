import { APP_NAME } from "../constants";
import { clearJwtCache } from "./jwt";
import { parsePem } from "./pem";

const DB_NAME = `${APP_NAME}-keystore`;
const DB_VERSION = 1;
const STORE = "keys";
const KEY_ID = "main";

interface KeyRecord {
  id: string;
  key: CryptoKey;
  appId: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function importPemKey(pem: string): Promise<CryptoKey> {
  const der = parsePem(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function saveKey(key: CryptoKey, appId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: KEY_ID, key, appId } satisfies KeyRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadKey(): Promise<{
  key: CryptoKey;
  appId: string;
} | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY_ID);
    req.onsuccess = () => {
      const r = req.result as KeyRecord | undefined;
      resolve(r ? { key: r.key, appId: r.appId } : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearKey(): Promise<void> {
  clearJwtCache();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
