import { APP_NAME } from "../constants";

const DB_NAME = `${APP_NAME}-keystore`;
const DB_VERSION = 1;
const STORE = "keys";
const KEY_ID = "main";

function parsePem(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

const JWT_LIFETIME = 300; // seconds

let cachedToken: string | null = null;
let cacheExp = 0;

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlJson(obj: object): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)).buffer as ArrayBuffer);
}

export async function mintJwt(key: CryptoKey, appId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cacheExp - 30) return cachedToken;

  const header = b64urlJson({ typ: "JWT", alg: "RS256", kid: appId });
  const payload = b64urlJson({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + JWT_LIFETIME,
  });

  const message = `${header}.${payload}`;
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(message),
  );

  cachedToken = `${message}.${b64url(sigBuf)}`;
  cacheExp = now + JWT_LIFETIME;
  return cachedToken;
}

export function clearJwtCache() {
  cachedToken = null;
  cacheExp = 0;
}

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
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
