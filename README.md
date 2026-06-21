# Lommin

A privacy-first personal spending tracker that connects to your European bank accounts via [Enable Banking](https://enablebanking.com/). No shared backend, no Lommin account, no individual tracking. Your data lives in your browser.

> **Try it:** [lommin.no](https://lommin.no)

---

## What it does

Connect your bank accounts once through the PSD2 consent flow, then sync transactions whenever you like. Categorize spending, spot trends, and export encrypted backups — all without your data ever hitting a server you don't control.

- Transactions and accounts are stored in IndexedDB, locally in your browser
- Your `.pem` signing key is imported as a non-extractable `CryptoKey` — the raw bytes are unrecoverable by JS after import and never leave the device
- Backup files are encrypted (AES-GCM) with a key derived from your passphrase (PBKDF2); the passphrase never leaves the device
- Your transaction data is available offline after the first sync

Don't have an Enable Banking account, or just want to try it out first? There's a built-in **demo mode** that seeds realistic synthetic data with no bank connection needed. You can also bring in real transactions from a **CSV export from your bank**, or import a full account history from **[Spiir](https://spiir.dk/)** (including Spiir's own categories, mapped to Lommin's taxonomy).

## Ways to run

### Just use lommin.no

[lommin.no](https://lommin.no) is the hosted version. It uses a shared CORS proxy to relay requests to Enable Banking (browsers can't call the API directly). The proxy can observe your transaction data and short-lived access tokens in transit — it never sees your signing key and can't mint new tokens. The hosted version also uses Cloudflare Web Analytics for anonymous page-view counting (cookieless, no individual tracking). See [lommin.no/privacy](https://lommin.no/privacy) for the full breakdown.

### Self-host the frontend

The app is a static SPA — no server needed. Build it and drop it on any static host:

```sh
cd frontend
npm install
npm run build
# deploy frontend/dist/ wherever you like
```

### Run your own proxy (zero-trust)

If you want nothing going through anyone else's infrastructure, deploy the CORS proxy yourself — it's a single-file Cloudflare Worker. See [`proxy/README.md`](./proxy/README.md) for step-by-step instructions, then point **Settings → CORS Proxy** in the app at your Worker's URL.

## The proxy and security

The only server-side piece is a stateless CORS proxy that relays requests between your browser and the Enable Banking API. It is [a single TypeScript file](./proxy/worker.ts) — short enough to read and verify yourself.

What it can and cannot see:

|                            | Status | Detail                                                                                                                     |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Your `.pem` signing key    | ✅ Safe | Never sent to the proxy. JWTs are signed locally with a non-extractable key.                                               |
| Your access token (JWT)    | ⚠️ In transit | Passes through in the `Authorization` header. Short-lived (5 min); the proxy can't mint new ones.                   |
| Your transaction data      | ⚠️ In transit | Passes through in responses while being relayed.                                                                    |
| Anything stored            | ✅ Safe | No bodies, tokens, or raw IPs are persisted. Only an opaque `SHA-256(ip)` counter for rate limiting, with a ~2-minute TTL. |

The real guarantee is the code itself — **read it, and/or run your own.**

## Repository layout

```
frontend/   React + Vite SPA
proxy/      Cloudflare Worker — stateless CORS relay to api.enablebanking.com
```

## Contributing

Bug reports, feature ideas, and pull requests are all welcome. If you want to work on something non-trivial, open an issue first so we can talk it through before you put in the effort.

- **Found a bug?** [Open an issue](https://github.com/pergpau/lommin/issues)
- **Have an idea?** [Start a discussion](https://github.com/pergpau/lommin/issues)
- **Want to contribute code?** Fork, branch, and open a PR — the smaller and more focused the better

See [`frontend/README.md`](./frontend/README.md) and [`proxy/README.md`](./proxy/README.md) for local dev setup.
