import { decryptStore, encryptStore } from "./cryptoFile";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const BACKUP_FILE_NAME = "lommin-backup.enc";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
export const GOOGLE_OAUTH_CHANNEL = "google-oauth";

export class DriveAuthError extends Error {
  constructor() {
    super("Tilgangstokenet er utløpt. Koble til Google Drive på nytt.");
    this.name = "DriveAuthError";
  }
}

async function driveRequest(
  method: string,
  url: string,
  token: string,
  body?: BodyInit,
  contentType?: string,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  });
  if (res.status === 401) throw new DriveAuthError();
  if (!res.ok) {
    let message = `Drive API-feil ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data.error?.message) message = data.error.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return res;
}

async function findBackupFile(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    fields: "files(id)",
    q: `name='${BACKUP_FILE_NAME}'`,
  });
  const res = await driveRequest("GET", `${DRIVE_API}/files?${params}`, token);
  const data = (await res.json()) as { files: { id: string }[] };
  return data.files[0]?.id ?? null;
}

export async function getDriveBackupModifiedTime(token: string): Promise<number | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    fields: "files(modifiedTime)",
    q: `name='${BACKUP_FILE_NAME}'`,
  });
  const res = await driveRequest("GET", `${DRIVE_API}/files?${params}`, token);
  const data = (await res.json()) as { files: { modifiedTime: string }[] };
  const iso = data.files[0]?.modifiedTime;
  return iso ? new Date(iso).getTime() : null;
}

function buildMultipartBody(metadata: string, fileBytes: Uint8Array, boundary: string): Uint8Array {
  const enc = new TextEncoder();
  const prefix = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const suffix = enc.encode(`\r\n--${boundary}--\r\n`);
  const out = new Uint8Array(prefix.length + fileBytes.length + suffix.length);
  out.set(prefix);
  out.set(fileBytes, prefix.length);
  out.set(suffix, prefix.length + fileBytes.length);
  return out;
}

export async function signInWithGoogle(
  clientId: string,
): Promise<{ token: string; expiresIn: number }> {
  const redirectUri = `${window.location.origin}/oauth/google`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: DRIVE_SCOPE,
  });
  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    "google-auth",
    "width=500,height=600,popup=1",
  );
  if (!popup) throw new Error("Popup ble blokkert. Tillat popups for denne siden.");

  return new Promise<{ token: string; expiresIn: number }>((resolve, reject) => {
    const channel = new BroadcastChannel(GOOGLE_OAUTH_CHANNEL);
    let done = false;

    const finish = (token?: string, expiresIn?: number, err?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(pollClosed);
      channel.close();
      if (err) reject(new Error(err));
      else resolve({ token: token!, expiresIn: expiresIn ?? 3600 });
    };

    const timer = setTimeout(
      () => finish(undefined, undefined, "Autentisering timed out."),
      120_000,
    );

    const pollClosed = setInterval(() => {
      if (popup.closed)
        setTimeout(() => finish(undefined, undefined, "Autentisering avbrutt."), 500);
    }, 500);

    channel.onmessage = (
      e: MessageEvent<{ access_token?: string; expires_in?: number; error?: string }>,
    ) => {
      if (e.data?.error) finish(undefined, undefined, e.data.error);
      else finish(e.data?.access_token, e.data?.expires_in);
    };
  });
}

export async function saveBackupToDrive(
  token: string,
  data: object,
  passphrase: string,
): Promise<number> {
  const [encrypted, fileId] = await Promise.all([
    encryptStore(data, passphrase),
    findBackupFile(token),
  ]);

  const boundary = `lommin_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = fileId
    ? JSON.stringify({ name: BACKUP_FILE_NAME })
    : JSON.stringify({ name: BACKUP_FILE_NAME, parents: ["appDataFolder"] });
  const body = buildMultipartBody(metadata, encrypted, boundary);

  const res = await driveRequest(
    fileId ? "PATCH" : "POST",
    `${DRIVE_UPLOAD_API}/files${fileId ? `/${fileId}` : ""}?uploadType=multipart&fields=modifiedTime`,
    token,
    body.buffer as ArrayBuffer,
    `multipart/related; boundary=${boundary}`,
  );
  const { modifiedTime } = (await res.json()) as { modifiedTime: string };
  return new Date(modifiedTime).getTime();
}

export async function loadBackupFromDrive(token: string, passphrase: string): Promise<object> {
  const fileId = await findBackupFile(token);
  if (!fileId) throw new Error("Ingen sikkerhetskopi funnet i Google Drive.");

  const res = await driveRequest("GET", `${DRIVE_API}/files/${fileId}?alt=media`, token);
  const buf = await res.arrayBuffer();
  return decryptStore(new Uint8Array(buf), passphrase);
}
