# Lommin CORS proxy

A stateless [Cloudflare Worker](https://workers.cloudflare.com/) that relays browser requests to the Enable Banking API. Browsers can't call `api.enablebanking.com` directly (no CORS headers), so this proxy adds them.

**The entire program is [`worker.ts`](./worker.ts) — ~130 lines. Read it; that is the trust model.**

## What it can and cannot see

|                            |                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ❌ Your `.pem` signing key | Never sent to the proxy. JWTs are signed in the browser with a non-extractable key.                                 |
| ⚠️ Your access token (JWT) | Passes through in the `Authorization` header. Short-lived (5 min); the proxy can't mint new ones.                   |
| ⚠️ Your transaction data   | Passes through in responses while being relayed.                                                                    |
| ❌ Anything stored         | No bodies, tokens, or raw IPs are persisted. Only an opaque `SHA-256(ip)` counter for rate limiting, ~2-minute TTL. |

A CORS proxy must terminate TLS to add CORS headers, so the operator is technically able to observe plaintext in transit. No remote server can cryptographically prove it isn't logging. **The guarantees above are enforced by the code** — so the real proof is: read it, and/or run your own.

## Deploy your own (zero-trust)

### 1. Install Wrangler and log in

```sh
npm install -g wrangler
wrangler login
```

### 2. Create the rate-limit KV namespace

```sh
cd proxy
wrangler kv namespace create RATE_LIMIT_KV
```

Copy the `id` printed by that command and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "paste-your-id-here"
```

### 3. Set your SPA origin

In `wrangler.toml`, set `ALLOWED_ORIGINS` to your deployed frontend URL:

```toml
[vars]
ALLOWED_ORIGINS = "https://your-app.app"
```

Multiple origins are comma-separated: `"https://lommin.no,https://subdomain.lommin.no"`.

### 4. Deploy

```sh
wrangler deploy
```

Wrangler prints the Worker URL (e.g. `https://proxy.your-account.workers.dev`). Point **Settings → CORS Proxy** in the app at that URL.

### 5. Update the frontend CSP

If you're also self-hosting the frontend, add your Worker URL to `connect-src` in `frontend/public/_headers`.

## Local dev

```sh
wrangler dev
```

Localhost origins (`localhost`, `127.0.0.1`) are always allowed, so the frontend dev server at `http://localhost:5173` works without any config changes. Rate limiting is skipped when `RATE_LIMIT_KV` is not bound (normal for local dev).

For local tunnels (ngrok, Cloudflare Tunnel, etc.), put the tunnel origin in `proxy/.dev.vars` — this file is gitignored and overrides `wrangler.toml` for `wrangler dev` only:

```
# proxy/.dev.vars
ALLOWED_ORIGINS=https://your-tunnel.ngrok.app
```

## Hardening built in

- **Origin allowlist** — only `ALLOWED_ORIGINS` (+ localhost) may use it; everything else gets `403`.
- **Path allowlist** — only `/aspsps`, `/auth`, `/sessions`, `/accounts/:id/transactions`, `/accounts/:id/balances` are forwarded; anything else is `404`. Not an open relay.
- **Header scrubbing** — only `Authorization` and `Content-Type` are forwarded upstream; `Host`, `Cookie`, `CF-*`, etc. are dropped.
- **Rate limiting** — 60 req/min per IP, fixed window, backed by KV with a hashed IP key.
- **Upstream timeout** — aborts after 25 s; returns `504` so a hung Enable Banking request can't tie up the Worker.
- **No logging** — no `console.log` of requests, bodies, or tokens.

## Adding a new endpoint

Add a regex to `PATH_ALLOWLIST` in `worker.ts`:

```ts
const PATH_ALLOWLIST: RegExp[] = [
  /^\/aspsps$/,
  /^\/auth$/,
  /^\/sessions$/,
  /^\/accounts\/[^/]+\/transactions$/,
  /^\/accounts\/[^/]+\/balances$/,
  /^\/your-new-endpoint$/, // add here
];
```
