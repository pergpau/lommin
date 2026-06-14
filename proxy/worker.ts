// Lommin CORS proxy — stateless relay to the Enable Banking API.
//
// Trust guarantees (verifiable by reading this file — it is the whole program):
//   • It NEVER receives the user's .pem signing key (only the already-signed JWT).
//   • It does NOT log, store, or inspect request/response bodies or the bearer token.
//   • The only persisted data is an opaque hashed-IP request counter for rate
//     limiting (see RATE_LIMIT_KV); no raw IPs, no bodies, no tokens are stored.
//   • It only forwards a fixed allowlist of Enable Banking endpoints, to allowlisted
//     origins, with a minimal forwarded header set.
//
// It still terminates TLS (a CORS proxy must, to add CORS headers), so the operator
// *could* see plaintext in transit. For zero trust, self-host this file unchanged.

const TARGET = "https://api.enablebanking.com";

// Upstream must answer within this budget, otherwise we abort and return 504 so a
// hung Enable Banking request can't tie up the Worker indefinitely.
const UPSTREAM_TIMEOUT_MS = 25_000;

// These endpoints only ever receive small JSON bodies (/auth, /sessions). Reject
// anything larger up front rather than streaming an arbitrarily large body upstream.
const MAX_BODY_BYTES = 128 * 1024;

// Origins allowed to use this proxy. Set ALLOWED_ORIGINS (comma-separated) in the
// Worker environment; localhost is always permitted for development.
function isAllowedOrigin(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    return false;
  }
  const list = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin);
}

// Only Enable Banking endpoints the app actually uses may be relayed.
const PATH_ALLOWLIST: RegExp[] = [
  /^\/aspsps$/,
  /^\/auth$/,
  /^\/sessions$/,
  /^\/accounts\/[^/]+\/transactions$/,
  /^\/accounts\/[^/]+\/balances$/,
];

function isAllowedPath(pathname: string): boolean {
  return PATH_ALLOWLIST.some((re) => re.test(pathname));
}

function corsHeaders(origin: string): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

// Per-IP rate limit backed by a KV namespace (fixed window).
// The IP is hashed before use as a key, so the KV never stores a raw client IP —
// the only data this proxy persists anywhere is an opaque hashed-IP request counter.
const RATE_LIMIT = 60; // requests
const RATE_WINDOW = 60; // seconds

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function rateLimited(req: Request, env: Env): Promise<boolean> {
  // FAIL-OPEN: with no KV bound, limiting is skipped. This is intentional for
  // `wrangler dev`, but it also means a PRODUCTION deploy that forgets the
  // RATE_LIMIT_KV binding silently has no limiter — keep the binding in
  // wrangler.toml and verify it after deploy.
  if (!env.RATE_LIMIT_KV) return false;
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const bucket = Math.floor(Date.now() / 1000 / RATE_WINDOW);
  const key = `rl:${await hashIp(ip)}:${bucket}`;
  // Read-modify-write is non-atomic (KV has no atomic increment), so concurrent
  // requests in the same window may slip 1–2 over the cap. Acceptable for a CORS
  // relay; use Durable Objects if strict enforcement is ever needed.
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) ?? "0", 10);
  if (current >= RATE_LIMIT) return true;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), {
    expirationTtl: RATE_WINDOW * 2,
  });
  return false;
}

export interface Env {
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin");

    if (!isAllowedOrigin(origin, env)) {
      return new Response("Forbidden origin", { status: 403 });
    }
    const allowedOrigin = origin as string;

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowedOrigin),
      });
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders(allowedOrigin),
      });
    }

    const url = new URL(req.url);
    if (!isAllowedPath(url.pathname)) {
      return new Response("Not found", {
        status: 404,
        headers: corsHeaders(allowedOrigin),
      });
    }

    if (req.method === "POST") {
      const len = parseInt(req.headers.get("Content-Length") ?? "", 10);
      if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
        return new Response("Payload too large", {
          status: 413,
          headers: corsHeaders(allowedOrigin),
        });
      }
    }

    if (await rateLimited(req, env)) {
      const h = corsHeaders(allowedOrigin);
      h.set("Retry-After", String(RATE_WINDOW));
      return new Response("Too many requests", { status: 429, headers: h });
    }

    // Forward only the headers Enable Banking needs — never relay the inbound
    // header set verbatim (drops Host, Origin, Cookie, CF-*, etc.).
    const upstreamHeaders = new Headers();
    const auth = req.headers.get("Authorization");
    if (auth) upstreamHeaders.set("Authorization", auth);
    const contentType = req.headers.get("Content-Type");
    if (contentType) upstreamHeaders.set("Content-Type", contentType);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(TARGET + url.pathname + url.search, {
        method: req.method,
        headers: upstreamHeaders,
        body: req.method === "POST" ? req.body : undefined,
        signal: controller.signal,
      });
    } catch {
      // Aborted (timeout) or a network failure reaching Enable Banking.
      return new Response("Upstream unavailable", {
        status: 504,
        headers: corsHeaders(allowedOrigin),
      });
    } finally {
      clearTimeout(timer);
    }

    // Copy back only what the SPA needs, plus CORS.
    const respHeaders = corsHeaders(allowedOrigin);
    const upstreamCt = upstream.headers.get("Content-Type");
    if (upstreamCt) respHeaders.set("Content-Type", upstreamCt);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  },
};
