import { decryptStore, encryptStore } from "./cryptoFile";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const BACKUP_FILE_NAME = "lommin-backup.enc";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata email";
const SILENT_REAUTH_TIMEOUT_MS = 8_000;
export const GOOGLE_OAUTH_CHANNEL = "google-oauth";

// True inside the OAuth popup/hidden-iframe that IS the redirect_uri target —
// used to stop the app instance loaded there from running its own background
// sync (which would otherwise recurse: iframe spawns iframe spawns iframe).
export function isOAuthCallbackContext(): boolean {
  return !!window.opener || window.location.pathname === "/oauth/google";
}

// An auth flow owns the tab's attention while it runs: the popup is waiting on
// the user, and the frame is mid-handshake. Background work that could start a
// competing flow — or worse, navigate the tab out from under an open popup —
// has to stand down until it finishes.
let _authFlowsInFlight = 0;

export function isAuthFlowInFlight(): boolean {
  return _authFlowsInFlight > 0;
}

async function duringAuthFlow<T>(fn: () => Promise<T>): Promise<T> {
  _authFlowsInFlight += 1;
  try {
    return await fn();
  } finally {
    _authFlowsInFlight -= 1;
  }
}

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

function buildAuthUrl(clientId: string, requestId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/oauth/google`,
    response_type: "token",
    scope: SCOPES,
    state: requestId,
    ...extra,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// state must match the requestId that initiated this flow — the channel is
// origin-wide, so without this a concurrent popup/iframe's response would
// otherwise resolve the wrong caller's promise. See silentReauth for why
// concurrent flows are common now.
type OAuthMessage = { access_token?: string; expires_in?: number; error?: string; state?: string };

function parseOAuthMessage(
  data: OAuthMessage | undefined,
  requestId: string,
): { ok: true; token: string; expiresIn: number } | { ok: false; error: string } | null {
  if (data?.state !== requestId) return null;
  if (data.error) return { ok: false, error: data.error };
  return { ok: true, token: data.access_token!, expiresIn: data.expires_in ?? 3600 };
}

export async function fetchAccountEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return typeof data.email === "string" ? data.email : null;
  } catch {
    return null;
  }
}

export function signInWithGoogle(
  clientId: string,
): Promise<{ token: string; expiresIn: number; email: string | null }> {
  return duringAuthFlow(() => runSignInPopup(clientId));
}

async function runSignInPopup(
  clientId: string,
): Promise<{ token: string; expiresIn: number; email: string | null }> {
  const requestId = crypto.randomUUID();
  const popup = window.open(
    buildAuthUrl(clientId, requestId),
    "google-auth",
    "width=500,height=600,popup=1",
  );
  if (!popup) throw new Error("Popup ble blokkert. Tillat popups for denne siden.");

  const { token, expiresIn } = await new Promise<{ token: string; expiresIn: number }>(
    (resolve, reject) => {
      const channel = new BroadcastChannel(GOOGLE_OAUTH_CHANNEL);
      let done = false;

      const finish = (result?: { token: string; expiresIn: number }, err?: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(pollClosed);
        channel.close();
        if (err) reject(new Error(err));
        else resolve(result!);
      };

      const timer = setTimeout(() => finish(undefined, "Autentisering timed out."), 120_000);

      const pollClosed = setInterval(() => {
        if (popup.closed) setTimeout(() => finish(undefined, "Autentisering avbrutt."), 500);
      }, 500);

      channel.onmessage = (e: MessageEvent<OAuthMessage>) => {
        const parsed = parseOAuthMessage(e.data, requestId);
        if (!parsed) return;
        if (parsed.ok) finish({ token: parsed.token, expiresIn: parsed.expiresIn });
        else finish(undefined, parsed.error);
      };
    },
  );

  return { token, expiresIn, email: await fetchAccountEmail(token) };
}

// Two failure modes that need opposite fixes, so they must stay distinguishable:
// "oauth-error" means Google answered and refused (its own code — login_required,
// interaction_required, consent_required — i.e. the iframe reached Google but
// carried no usable session, typically because the browser partitions or blocks
// its cookies there). "timeout" means the callback never posted at all, which
// points at the iframe or the callback being blocked from rendering.
export type SilentReauthResult =
  | { ok: true; token: string; expiresIn: number; email: string | null }
  | { ok: false; reason: "oauth-error" | "timeout"; error?: string };

// Silent renewal: re-run the same auth request with prompt=none in a hidden
// iframe instead of a popup. If the browser still has an active Google
// session and consent was already granted, Google responds with a fresh
// token with no visible UI. Never throws — every failure resolves to an
// ok:false result, which callers treat as "fall back to the visible
// reconnect flow".
export function silentReauth(
  clientId: string,
  loginHint?: string | null,
): Promise<SilentReauthResult> {
  return duringAuthFlow(() => runSilentReauthFrame(clientId, loginHint));
}

async function runSilentReauthFrame(
  clientId: string,
  loginHint?: string | null,
): Promise<SilentReauthResult> {
  const requestId = crypto.randomUUID();
  const url = buildAuthUrl(clientId, requestId, {
    prompt: "none",
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "absolute",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  iframe.src = url;
  document.body.appendChild(iframe);

  type Outcome =
    | { token: string; expiresIn: number }
    | { reason: "oauth-error" | "timeout"; error?: string };

  try {
    const result = await new Promise<Outcome>((resolve) => {
      const channel = new BroadcastChannel(GOOGLE_OAUTH_CHANNEL);
      let done = false;

      const finish = (v: Outcome) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        channel.close();
        resolve(v);
      };

      const timer = setTimeout(() => finish({ reason: "timeout" }), SILENT_REAUTH_TIMEOUT_MS);

      channel.onmessage = (e: MessageEvent<OAuthMessage>) => {
        const parsed = parseOAuthMessage(e.data, requestId);
        if (!parsed) return;
        finish(
          parsed.ok
            ? { token: parsed.token, expiresIn: parsed.expiresIn }
            : { reason: "oauth-error", error: parsed.error },
        );
      };
    });
    if (!("token" in result)) return { ok: false, ...result };
    return { ok: true, ...result, email: await fetchAccountEmail(result.token) };
  } finally {
    iframe.remove();
  }
}

// ---------------------------------------------------------------------------
// Top-level redirect reauth
//
// The hidden iframe above can only renew silently while the browser lets
// accounts.google.com read its own cookies inside a cross-site frame. Where it
// doesn't, Google answers interaction_required for a session it would happily
// honour at top level. So the fallback is the same prompt=none request run as a
// full-page navigation: the tab goes to Google, bounces straight back to
// /oauth/google with a token in the fragment, and OAuthCallback restores the
// route. No user interaction, at the cost of a reload.
//
// Three pieces of stored state keep that from becoming a redirect loop or a
// pointless round trip:
//   - the pending entry (sessionStorage, per tab) marks a redirect in flight
//     and carries the route to come back to;
//   - the retry stamp throttles attempts, and is pushed far out when Google
//     refuses, so a genuinely interaction-needing account falls through to the
//     reconnect modal instead of bouncing the tab;
//   - the frame-blocked stamp remembers that the iframe strategy is dead in
//     this browser, so later renewals skip straight to the redirect instead of
//     waiting out its timeout first.

const PENDING_REDIRECT_KEY = "lommin:reauth-redirect";
const REDIRECT_RETRY_AFTER_KEY = "lommin:reauth-redirect-after";
const FRAME_BLOCKED_KEY = "lommin:silent-frame-blocked";

const REDIRECT_MIN_INTERVAL_MS = 2 * 60_000;
const REDIRECT_REFUSED_COOLDOWN_MS = 6 * 60 * 60_000;
const FRAME_BLOCKED_TTL_MS = 7 * 24 * 60 * 60_000;
const PENDING_REDIRECT_TTL_MS = 60_000;

export type PendingRedirectReauth = { state: string; returnTo: string; startedAt: number };

function readStamp(key: string): number | null {
  const raw = localStorage.getItem(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function isFrameSilentBlocked(): boolean {
  const at = readStamp(FRAME_BLOCKED_KEY);
  return at !== null && Date.now() - at < FRAME_BLOCKED_TTL_MS;
}

export function markFrameSilentBlocked(): void {
  localStorage.setItem(FRAME_BLOCKED_KEY, String(Date.now()));
}

export function readPendingRedirectReauth(): PendingRedirectReauth | null {
  const raw = sessionStorage.getItem(PENDING_REDIRECT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingRedirectReauth;
    if (typeof parsed?.state !== "string" || typeof parsed?.returnTo !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingRedirectReauth(): void {
  sessionStorage.removeItem(PENDING_REDIRECT_KEY);
}

// Pushes the next attempt out. Called with the long cooldown when Google
// refuses at top level too — at that point only the visible flow can help.
export function blockRedirectReauth(ms: number = REDIRECT_REFUSED_COOLDOWN_MS): void {
  localStorage.setItem(REDIRECT_RETRY_AFTER_KEY, String(Date.now() + ms));
}

export function allowRedirectReauth(): void {
  localStorage.removeItem(REDIRECT_RETRY_AFTER_KEY);
}

export function canRedirectReauth(): boolean {
  if (isOAuthCallbackContext() || window.parent !== window) return false;
  // Navigating now would tear down the tab that owns an open consent popup.
  if (isAuthFlowInFlight()) return false;
  const pending = readPendingRedirectReauth();
  if (pending && Date.now() - pending.startedAt < PENDING_REDIRECT_TTL_MS) return false;
  const after = readStamp(REDIRECT_RETRY_AFTER_KEY);
  return after === null || Date.now() >= after;
}

// Navigates the tab away — nothing after this call runs.
export function startRedirectReauth(clientId: string, loginHint?: string | null): void {
  const requestId = crypto.randomUUID();
  const pending: PendingRedirectReauth = {
    state: requestId,
    returnTo: `${window.location.pathname}${window.location.search}`,
    startedAt: Date.now(),
  };
  sessionStorage.setItem(PENDING_REDIRECT_KEY, JSON.stringify(pending));
  // Throttle before leaving, not on the way back: if the round trip never
  // completes, the stamp is the only thing standing between a broken redirect
  // and an endlessly bouncing tab.
  blockRedirectReauth(REDIRECT_MIN_INTERVAL_MS);
  window.location.assign(
    buildAuthUrl(clientId, requestId, {
      prompt: "none",
      ...(loginHint ? { login_hint: loginHint } : {}),
    }),
  );
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
