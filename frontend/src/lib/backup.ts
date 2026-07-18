// The backup module: one owner for the save/restore pipeline
// (export → encrypt → write to file/Drive → stamp timestamps → hash)
// and for the Drive-sync freshness decision. File and Drive are two
// adapters behind the same BackupTarget seam.

import { loadEncryptedFile, saveEncryptedFile } from "./cryptoFile";
import {
  DriveAuthError,
  getDriveBackupModifiedTime,
  loadBackupFromDrive,
  saveBackupToDrive,
  silentReauth,
} from "./googleDrive";
import {
  type AppSettings,
  clearDriveToken,
  getAllSettings,
  getDriveAccountEmail,
  getDriveToken,
  getLastBackupHash,
  getSetting,
  getSyncedSettings,
  hasDriveTokenStored,
  persistDriveToken,
  setDriveAccountEmail,
  setLastBackupHash,
  setSetting,
} from "./settings";
import { exportAll, getAllTransactions, importAll } from "./store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export type BackupErrorKind =
  | "cancelled" // user closed the file picker — UI should stay silent
  | "wrong-passphrase" // decryption failed with a passphrase provided
  | "passphrase-required" // decryption failed without a passphrase
  | "drive-auth" // Drive token expired: already cleared + reconnect event fired
  | "drive-not-connected" // Drive is the target but no valid token is stored
  | "unknown"; // message carries the original error text

export class BackupError extends Error {
  readonly kind: BackupErrorKind;

  // No default message: UIs render e.message when present and fall back to
  // their own generic i18n key otherwise, so a kind slug must never leak out.
  constructor(kind: BackupErrorKind, message?: string, options?: { cause?: unknown }) {
    super(message ?? "", options);
    this.name = "BackupError";
    this.kind = kind;
  }
}

export function classifyBackupError(e: unknown, passphraseProvided: boolean): BackupErrorKind {
  if (e instanceof BackupError) return e.kind;
  if (e instanceof DriveAuthError) return "drive-auth";
  if (e instanceof DOMException && e.name === "OperationError")
    return passphraseProvided ? "wrong-passphrase" : "passphrase-required";
  if ((e as Error | null)?.name === "AbortError") return "cancelled";
  return "unknown";
}

function toBackupError(e: unknown, passphraseProvided: boolean): BackupError {
  if (e instanceof BackupError) return e;
  const message = e instanceof Error ? e.message : undefined;
  return new BackupError(classifyBackupError(e, passphraseProvided), message, { cause: e });
}

// ---------------------------------------------------------------------------
// Targets: file and Drive behind one seam

interface BackupTarget {
  save(payload: object, passphrase: string): Promise<{ savedAt: number }>;
  load(passphrase: string): Promise<{ data: object; savedAt: number | null }>;
}

const fileTarget: BackupTarget = {
  async save(payload, passphrase) {
    await saveEncryptedFile(payload, passphrase);
    return { savedAt: Date.now() };
  },
  async load(passphrase) {
    const data = await loadEncryptedFile(passphrase);
    const exportedAt = (data as { exportedAt?: number }).exportedAt;
    return { data, savedAt: exportedAt ?? null };
  },
};

// Attempts a silent (no popup, no user interaction) token renewal using the
// last-known account as a login_hint. Returns the fresh token, or null if
// silent renewal isn't possible (no active Google session, revoked consent,
// ambiguous multi-account session, etc.) — callers fall back to the visible
// reconnect modal in that case.
async function trySilentReauth(): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID) return null;
  const email = await getDriveAccountEmail();
  const result = await silentReauth(GOOGLE_CLIENT_ID, email);
  if (!result) return null;
  await persistDriveToken(result.token, result.expiresIn);
  if (result.email) await setDriveAccountEmail(result.email);
  window.dispatchEvent(new Event("lommin:drive-token-updated"));
  return result.token;
}

async function withDriveErrors<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const stored = await getDriveToken();
  if (!stored) throw new BackupError("drive-not-connected");
  try {
    return await fn(stored.token);
  } catch (e) {
    if (e instanceof DriveAuthError) {
      const fresh = await trySilentReauth();
      if (fresh) {
        try {
          return await fn(fresh);
        } catch (e2) {
          if (!(e2 instanceof DriveAuthError)) throw e2;
          void clearDriveToken();
          window.dispatchEvent(new Event("lommin:drive-auth-expired"));
          throw new BackupError("drive-auth", e2.message, { cause: e2 });
        }
      }
      void clearDriveToken();
      window.dispatchEvent(new Event("lommin:drive-auth-expired"));
      throw new BackupError("drive-auth", e.message, { cause: e });
    }
    throw e;
  }
}

const driveTarget: BackupTarget = {
  save: (payload, passphrase) =>
    withDriveErrors(async (token) => ({
      savedAt: await saveBackupToDrive(token, payload, passphrase),
    })),
  load: (passphrase) =>
    withDriveErrors(async (token) => {
      const [data, savedAt] = await Promise.all([
        loadBackupFromDrive(token, passphrase),
        getDriveBackupModifiedTime(token).catch(() => null),
      ]);
      return { data, savedAt };
    }),
};

function targetFor(method: "drive" | "file"): BackupTarget {
  return method === "drive" ? driveTarget : fileTarget;
}

// ---------------------------------------------------------------------------
// Save pipeline

async function buildPayload(): Promise<object> {
  const [data, settings] = await Promise.all([exportAll(), getSyncedSettings()]);
  return { ...data, settings };
}

// Hash ignores the volatile exportedAt stamp so identical data hashes
// identically across exports (this is what makes the autosave dedup work).
export async function computeBackupHash(payload: object): Promise<string> {
  const json = JSON.stringify({ ...(payload as Record<string, unknown>), exportedAt: undefined });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Only mark the data fully saved if no write landed while the backup was
// uploading; a concurrent edit must keep lastDataModifiedAt > lastLocalSavedAt.
async function finishSave(
  payload: object,
  savedAt: number,
  modifiedBefore: number | null,
): Promise<void> {
  const hash = await computeBackupHash(payload);
  const modifiedNow = await getSetting("lastDataModifiedAt");
  await Promise.all([
    setSetting("lastLocalSavedAt", savedAt),
    setLastBackupHash(hash),
    ...(modifiedNow === modifiedBefore ? [setSetting("lastDataModifiedAt", savedAt)] : []),
  ]);
}

export async function saveBackup(passphrase = ""): Promise<void> {
  try {
    const [method, modifiedBefore] = await Promise.all([
      getSetting("backupMethod"),
      getSetting("lastDataModifiedAt"),
    ]);
    const payload = await buildPayload();
    const { savedAt } = await targetFor(method).save(payload, passphrase);
    await finishSave(payload, savedAt, modifiedBefore);
  } catch (e) {
    throw toBackupError(e, passphrase !== "");
  }
}

// ---------------------------------------------------------------------------
// Restore pipeline

export type RestorePlan = {
  data: object;
  backupCount: number;
  localCount: number;
  backupSavedAt: number | null; // Drive modifiedTime, or the file's exportedAt
  localSavedAt: number | null;
  freshness: "local-newer" | "backup-newer" | "same" | "unknown";
  warnFewerTransactions: boolean;
};

export function compareFreshness(
  localSavedAt: number | null,
  backupSavedAt: number | null,
): RestorePlan["freshness"] {
  const local = localSavedAt ?? 0;
  const backup = backupSavedAt ?? 0;
  if (local > 0 && local === backup) return "same";
  if (local > 0 && local > backup) return "local-newer";
  if (backup > 0 && backup > local) return "backup-newer";
  return "unknown";
}

export function shouldWarnBeforeRestore(backupCount: number, localCount: number): boolean {
  return backupCount < localCount;
}

export async function loadBackup(
  passphrase = "",
  opts?: { source?: "drive" | "file" },
): Promise<RestorePlan> {
  try {
    const source = opts?.source ?? (await getSetting("backupMethod"));
    const { data, savedAt } = await targetFor(source).load(passphrase);
    const [localTxs, localSavedAt] = await Promise.all([
      getAllTransactions(),
      getSetting("lastLocalSavedAt"),
    ]);
    const raw = data as { transactions?: unknown[] };
    const backupCount = Array.isArray(raw.transactions) ? raw.transactions.length : 0;
    return {
      data,
      backupCount,
      localCount: localTxs.length,
      backupSavedAt: savedAt,
      localSavedAt,
      freshness: compareFreshness(localSavedAt, savedAt),
      warnFewerTransactions: shouldWarnBeforeRestore(backupCount, localTxs.length),
    };
  } catch (e) {
    throw toBackupError(e, passphrase !== "");
  }
}

// merge: adds to existing data, then schedules a push like any other write.
// overwrite: the backup is authoritative — adopt its timestamps and hash so
// the next Drive-sync pass sees local and remote as identical.
export async function applyRestore(
  plan: RestorePlan,
  opts?: { mode?: "overwrite" | "merge" },
): Promise<{ inserted: number; skipped: number }> {
  const overwrite = opts?.mode === "overwrite";
  try {
    const result = await importAll(plan.data, { overwrite });
    if (overwrite) {
      if (plan.backupSavedAt) {
        await Promise.all([
          setSetting("lastLocalSavedAt", plan.backupSavedAt),
          setSetting("lastDataModifiedAt", plan.backupSavedAt),
        ]);
      }
      await setLastBackupHash(await computeBackupHash(plan.data));
    } else {
      void setSetting("lastDataModifiedAt", Date.now());
      scheduleAutosave();
    }
    window.dispatchEvent(new Event("lommin:data-reload"));
    return result;
  } catch (e) {
    throw toBackupError(e, false);
  }
}

// ---------------------------------------------------------------------------
// Autosave (debounced background push to Drive)

type SaveListener = (saving: boolean) => void;
const _listeners = new Set<SaveListener>();

export function addSaveListener(cb: SaveListener): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutosave(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => void triggerAutosave(), 3000);
}

export async function triggerAutosave(): Promise<void> {
  try {
    const { driveAutosave, backupMethod, usePassphrase, lastDataModifiedAt } =
      await getAllSettings();
    if (!driveAutosave || backupMethod !== "drive" || usePassphrase) return;
    if (!(await getDriveToken())) return;

    const payload = await buildPayload();
    const hash = await computeBackupHash(payload);
    if (hash === (await getLastBackupHash())) return;

    _listeners.forEach((cb) => cb(true));
    try {
      const { savedAt } = await driveTarget.save(payload, "");
      await finishSave(payload, savedAt, lastDataModifiedAt);
    } finally {
      _listeners.forEach((cb) => cb(false));
    }
  } catch (e) {
    // drive-auth already cleared the token and fired the reconnect event
    console.warn("Autosave to Drive failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Background Drive-sync decision (consumed by useDriveSync)

export type SyncAssessment =
  | { action: "disabled" }
  | { action: "reauth-needed" }
  | { action: "push" }
  | { action: "pull"; driveModifiedAt: number }
  | { action: "in-sync" };

export function decideSyncAction(
  settings: Pick<
    AppSettings,
    "driveAutosave" | "backupMethod" | "usePassphrase" | "lastDataModifiedAt" | "lastLocalSavedAt"
  >,
  token: { has: boolean; had: boolean },
  driveModifiedAt: number | null,
): SyncAssessment["action"] {
  if (!settings.driveAutosave || settings.backupMethod !== "drive" || settings.usePassphrase)
    return "disabled";
  if (!token.has) return token.had ? "reauth-needed" : "disabled";
  const hasUnsavedLocalChanges =
    settings.lastDataModifiedAt !== null &&
    (settings.lastLocalSavedAt === null || settings.lastDataModifiedAt > settings.lastLocalSavedAt);
  if (hasUnsavedLocalChanges) return "push";
  if (driveModifiedAt === null) return "in-sync";
  if (settings.lastLocalSavedAt !== null && driveModifiedAt <= settings.lastLocalSavedAt)
    return "in-sync";
  return "pull";
}

export async function assessDriveSync(): Promise<SyncAssessment> {
  const [settings, stored] = await Promise.all([getAllSettings(), getDriveToken()]);
  let token = { has: !!stored, had: !!stored || (await hasDriveTokenStored()) };

  // Decide without the remote timestamp first, so gated states skip the fetch.
  let action = decideSyncAction(settings, token, null);
  if (action === "reauth-needed") {
    const fresh = await trySilentReauth();
    if (!fresh) {
      window.dispatchEvent(new Event("lommin:drive-auth-expired"));
      return { action: "reauth-needed" };
    }
    token = { has: true, had: true };
    action = decideSyncAction(settings, token, null);
  }
  if (action === "disabled" || action === "push") return { action };

  const driveModifiedAt = await withDriveErrors(getDriveBackupModifiedTime);
  if (driveModifiedAt !== null && decideSyncAction(settings, token, driveModifiedAt) === "pull")
    return { action: "pull", driveModifiedAt };
  return { action: "in-sync" };
}
