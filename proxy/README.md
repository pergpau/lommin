# Lommin CORS proxy

A stateless [Cloudflare Worker](https://workers.cloudflare.com/) that relays browser
requests to the Enable Banking API. Browsers can't call `api.enablebanking.com`
directly (no CORS headers), so this proxy adds them. **The entire program is
[`worker.ts`](./worker.ts) — under 120 lines. Read it; that is the trust model.**

## What it can and cannot see

| | |
|---|---|
| ❌ Your `.pem` signing key | Never sent to the proxy. JWTs are signed in your browser with a non-extractable key. |
| ⚠️ Your access token (JWT) | Passes through in the `Authorization` header. Short-lived (**5 min**), and the proxy cannot mint new ones (no key). |
| ⚠️ Your transaction data | Passes through in responses, in plaintext, while being relayed. |
| ❌ Anything stored | No bodies, tokens, or raw IPs are persisted. The only stored data is an opaque `SHA-256(ip)` counter for rate limiting, with a ~2-minute TTL. |

**The honest limit:** a CORS proxy *must* terminate TLS to add CORS headers, so the
operator of a hosted proxy is technically able to observe plaintext in transit. No
remote server can cryptographically prove it isn't logging. The guarantees above are
enforced *by the code* — so the real proof is: **read it, and/or run your own.**

## Hardening built in

- **Origin allowlist** — only `ALLOWED_ORIGINS` (+ localhost for dev) may use it.
- **Path allowlist** — only `/aspsps`, `/auth`, `/sessions`, `/accounts/:id/transactions`
  are forwarded; anything else is `404`. Not an open relay.
- **Header scrubbing** — only `Authorization` + `Content-Type` are forwarded upstream;
  inbound `Host`, `Cookie`, `CF-*`, etc. are dropped.
- **Rate limiting** — per-IP fixed window (60 req/min) via a hashed-IP KV counter.
- **No logging** — no `console.log` of requests, bodies, or tokens.

## Run your own (zero-trust path)

```sh
npm i -g wrangler
wrangler login

# one-time: create the rate-limit KV namespace, paste the id into wrangler.toml
wrangler kv namespace create RATE_LIMIT_KV

# set your SPA origin(s)
#   edit ALLOWED_ORIGINS in wrangler.toml

wrangler deploy
```

Then point **Settings → CORS Proxy** in the app at your Worker's URL. Nothing then
flows through anyone else's infrastructure — only your browser, your Worker, and
Enable Banking.

For local development: `wrangler dev` (localhost origins are always allowed).
