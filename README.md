# Lommin

A privacy-first personal spending tracker that connects to your European bank accounts via [Enable Banking](https://enablebanking.com/).

---

## What it does

Connect your bank accounts and sync transactions whenever you like. Categorize spending, spot trends, and export encrypted backups — all without your data ever hitting a server you don't control.

- Transactions and accounts are stored in IndexedDB, locally in your browser
- Your `.pem` signing key is imported as a non-extractable `CryptoKey` — the raw bytes are unrecoverable by JS after import and never leave the device
- Backup files are encrypted (AES-GCM) with a key derived from your passphrase (PBKDF2); the passphrase never leaves the device
- Your transaction data is available offline after the first sync

Don't have an Enable Banking account, or just want to try it out first? There's a built-in **demo mode** that seeds realistic synthetic data with no bank connection needed. You can also bring in real transactions from a **CSV export from your bank**, or import a full account history from **[Spiir](https://spiir.dk/)** (including Spiir's own categories, mapped to Lommin's taxonomy).


## Screenshots
<img width="264" height="559" alt="image" src="https://github.com/user-attachments/assets/7251c6ac-8221-486c-b64d-20ac7608519a" />
<img width="264" height="559" alt="image" src="https://github.com/user-attachments/assets/5ef54067-bd78-4ae4-a634-895cb0fc6e1f" />
<img width="264" height="559" alt="image" src="https://github.com/user-attachments/assets/7084db37-2b35-49a0-adea-d11ce47eb1ca" />

## Demo
You can try it out on https://demo.lommin.no but you need to host it yourself to connect bank accounts and store data.

## Self-hosting

Lommin is a self-hosted app. You deploy both the frontend (a static SPA) and a CORS proxy (f.ex. a Cloudflare Worker). No shared infrastructure.

### Prerequisites

- Node.js 20+
- A free [Enable Banking](https://enablebanking.com/) account with a `.pem` signing key (for transaction sync)
- A proxy that redirects traffic from the frontend to Enable Banking. F.ex. a [Cloudflare](https://www.cloudflare.com/) worker proxy (free tier available).
- Any static hosting provider for the frontend (Netlify, Vercel, Cloudflare Pages, etc.)
- (Optional) A Google Cloud project with OAuth credentials if you want Google Drive backup

### 1. Deploy the CORS proxy

The proxy is a single-file Cloudflare Worker that relays browser requests to the Enable Banking API. See [`proxy/README.md`](./proxy/README.md) for step-by-step instructions.

```sh
cd proxy
wrangler kv namespace create RATE_LIMIT_KV  # paste the id into wrangler.toml
# set ALLOWED_ORIGINS in wrangler.toml to your frontend URL
wrangler deploy
```

Note the Worker URL (e.g. `https://proxy.your-account.workers.dev`).

### 2. Build and deploy the frontend

```sh
cd frontend
cp .env.example .env
# edit .env:
#   VITE_PROXY_URL=https://proxy.your-account.workers.dev
#   VITE_GOOGLE_CLIENT_ID=...  (optional, for Drive backup)
npm install
npm run build
# deploy frontend/dist/ to your static host
```

**Netlify** — connect the repo in the Netlify dashboard or:

```sh
netlify deploy --dir frontend/dist --prod
```

The included `netlify.toml` configures the build command and publish directory. Set `VITE_PROXY_URL` (and optionally `VITE_GOOGLE_CLIENT_ID`) as environment variables in the Netlify dashboard.

### 3. Update the proxy's allowed origins

After deploying the frontend, add your SPA URL to `ALLOWED_ORIGINS` in `proxy/wrangler.toml` and redeploy the proxy.

### 4. Configure Enable Banking

Register an application in the [Enable Banking dashboard](https://enablebanking.com/sign-in/). The app shows you the correct redirect, privacy, and terms URLs to use during onboarding — they match your deployment's origin automatically.

### 5. (Optional) Google Drive backup

To enable encrypted Google Drive backup:

1. Create a Google Cloud project and enable the Google Drive API
2. Create an OAuth 2.0 client ID (Web application type)
3. Add `https://your-app.example.com/oauth/google` as an authorized redirect URI
4. Set `VITE_GOOGLE_CLIENT_ID` in your frontend `.env` and rebuild

## The proxy and security

The only server-side piece is a stateless CORS proxy that relays requests between your browser and the Enable Banking API. It is [a single TypeScript file](./proxy/worker.ts) — short enough to read and verify yourself.

What it can and cannot see:

|                            | Status | Detail                                                                                                                     |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Your `.pem` signing key    | Safe | Never sent to the proxy. JWTs are signed locally with a non-extractable key.                                               |
| Your access token (JWT)    | In transit | Passes through in the `Authorization` header. Short-lived (5 min); the proxy can't mint new ones.                   |
| Your transaction data      | In transit | Passes through in responses while being relayed.                                                                    |
| Anything stored            | Safe | No bodies, tokens, or raw IPs are persisted. Only an opaque `SHA-256(ip)` counter for rate limiting, with a ~2-minute TTL. |

The real guarantee is the code itself — **read it, since you're running your own.**

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
