# Lommin

A privacy-first personal spending tracker that connects to your European bank accounts via [Enable Banking](https://enablebanking.com/).

---

## What it does

Lommin gives you a clear picture of where your money goes — without handing your financial life to yet another company. Connect your European bank accounts, pull in your transactions, and see your spending come to life.

- **See your spending clearly.** Every transaction is sorted into categories, so you can tell at a glance what you're spending on groceries, transport, eating out, or anything else.
- **Spot the trends.** Watch how your spending shifts over time, catch the months that got away from you, and keep an eye on what matters to you.
- **Automatic categorization.** New transactions are sorted for you, so you spend less time tagging and more time understanding.
- **Your data stays yours.** Everything lives on your own device, in your own browser. Nothing is sent to a server we control — because there isn't one.
- **Encrypted backups you own.** Save a secure, password-protected backup to a file or to your own Google Drive, and restore it whenever you need to.
- **Works offline.** Once your transactions are synced, you can browse them anytime, even without a connection.

Want to try it before connecting a bank? A built-in **demo mode** fills the app with realistic sample data so you can explore every feature instantly. Already track your money elsewhere? Bring your history along with a **CSV export from your bank** or a full import from **[Spiir](https://spiir.dk/)** — categories and all.

## Screenshots

<img width="264" height="559" alt="image" src="https://github.com/user-attachments/assets/7251c6ac-8221-486c-b64d-20ac7608519a" />
<img width="264" height="559" alt="image" src="https://github.com/user-attachments/assets/5ef54067-bd78-4ae4-a634-895cb0fc6e1f" />
<img width="264" height="559" alt="image" src="https://github.com/user-attachments/assets/7084db37-2b35-49a0-adea-d11ce47eb1ca" />

## Demo

You can try it out on https://demo.lommin.no but you need to host it yourself to connect bank accounts and save data.

## Self-hosting

Lommin is a self-hosted app. You deploy both the frontend (a static SPA) and a CORS proxy (any proxy works; a Cloudflare Worker example is included). No shared infrastructure.

### Prerequisites

- Node.js 20+
- A free [Enable Banking](https://enablebanking.com/) account with a `.pem` signing key (for transaction sync)
- A CORS proxy that forwards requests from the frontend to Enable Banking — any proxy works; this repo includes a ready-to-deploy [Cloudflare Worker](https://www.cloudflare.com/) example (free tier available)
- Any static hosting provider for the frontend (Netlify, Vercel, Cloudflare Pages, etc.)
- (Optional) A Google Cloud project with OAuth credentials if you want Google Drive backup

### 1. Deploy the CORS proxy

Lommin needs a CORS proxy that relays browser requests to the Enable Banking API. **Any proxy will do** — its only job is to forward requests to `api.enablebanking.com` with the right CORS headers. You can use an existing proxy, roll your own, or use the ready-made example included in this repo.

The [`proxy/`](./proxy) directory ships a single-file Cloudflare Worker you can deploy as-is (free tier available). See [`proxy/README.md`](./proxy/README.md) for step-by-step instructions.

```sh
cd proxy
wrangler kv namespace create RATE_LIMIT_KV  # paste the id into wrangler.toml
# set ALLOWED_ORIGINS in wrangler.toml to your frontend URL
wrangler deploy
```

Note the resulting proxy URL (e.g. `https://proxy.your-account.workers.dev`) — you'll point the frontend at it in the next step.

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

`frontend/dist/` is a plain static bundle, so **any static host works** — Netlify, Vercel, Cloudflare Pages, GitHub Pages, or your own server. Whichever you choose, set `VITE_PROXY_URL` (and optionally `VITE_GOOGLE_CLIENT_ID`) at build time, and make sure SPA routing falls back to `index.html` (handled by the included `public/_redirects` on Netlify).

As an example, to deploy to **Netlify** — connect the repo in the Netlify dashboard or:

```sh
netlify deploy --dir frontend/dist --prod
```

The included `netlify.toml` configures the build command and publish directory. Set `VITE_PROXY_URL` (and optionally `VITE_GOOGLE_CLIENT_ID`) as environment variables in the Netlify dashboard.

### 3. Update the proxy's allowed origins

After deploying the frontend, allow your SPA's URL as a CORS origin on your proxy so the browser's requests aren't blocked. With the included Cloudflare Worker example, add your SPA URL to `ALLOWED_ORIGINS` in `proxy/wrangler.toml` and redeploy the proxy.

### 4. Configure Enable Banking

Register an application in the [Enable Banking dashboard](https://enablebanking.com/sign-in/). The app shows you the correct redirect, privacy, and terms URLs to use during onboarding — they match your deployment's origin automatically.

### 5. (Optional) Google Drive backup

To enable encrypted Google Drive backup:

1. Create a Google Cloud project and enable the Google Drive API
2. Create an OAuth 2.0 client ID (Web application type)
3. Add `https://your-app.example.com/oauth/google` as an authorized redirect URI
4. Set `VITE_GOOGLE_CLIENT_ID` in your frontend `.env` and rebuild

## The proxy and security

The only server-side piece is a stateless CORS proxy that relays requests between your browser and the Enable Banking API — and you run it yourself, on your own infrastructure. Nothing here goes through servers we operate. The included example is [a single TypeScript file](./proxy/worker.ts) — short enough to read and verify yourself before you deploy it.

What it can and cannot see:

|                         | Status     | Detail                                                                                                                     |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Your `.pem` signing key | Safe       | Never sent to the proxy. JWTs are signed locally with a non-extractable key.                                               |
| Your access token (JWT) | In transit | Passes through in the `Authorization` header. Short-lived (5 min); the proxy can't mint new ones.                          |
| Your transaction data   | In transit | Passes through in responses while being relayed.                                                                           |
| Anything stored         | Safe       | No bodies, tokens, or raw IPs are persisted. Only an opaque `SHA-256(ip)` counter for rate limiting, with a ~2-minute TTL. |

The real guarantee is the code itself — **read it, since you're running your own.**

## Repository layout

```
frontend/   React + Vite SPA
proxy/      Example Cloudflare Worker — stateless CORS relay to api.enablebanking.com
```

## Contributing

Bug reports, feature ideas, and pull requests are all welcome. If you want to work on something non-trivial, open an issue first so we can talk it through before you put in the effort.

- **Found a bug?** [Open an issue](https://github.com/pergpau/lommin/issues)
- **Have an idea?** [Start a discussion](https://github.com/pergpau/lommin/issues)
- **Want to contribute code?** Fork, branch, and open a PR — the smaller and more focused the better

See [`frontend/README.md`](./frontend/README.md) and [`proxy/README.md`](./proxy/README.md) for local dev setup.
