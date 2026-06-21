# Lommin — frontend

React + TypeScript + Vite SPA. No backend — all data is stored locally in IndexedDB.

## Prerequisites

- Node.js 20+
- An [Enable Banking](https://enablebanking.com/) application with a `.pem` signing key (or just use demo mode in the app)

## Local dev

```sh
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The dev server proxies requests through `https://proxy.lommin.no` by default (the shared hosted proxy). You can point it at a local proxy instead via **Settings → CORS Proxy** in the app, or by running `wrangler dev` from `proxy/` — see [`../proxy/README.md`](../proxy/README.md).

## Build

```sh
npm run build
# output: frontend/dist/
```

This runs `tsc -b` (type check) followed by `vite build`. The `dist/` folder is a fully static site — no Node.js required to serve it.

## Deploy

Drop `frontend/dist/` on any static host. The included `public/_redirects` file handles SPA routing on Netlify (`/* /index.html 200`). For other hosts, set up a catch-all redirect to `index.html` yourself.

**Netlify (one-time setup):**

```sh
# from the repo root
netlify deploy --dir frontend/dist --prod
```

Or connect the repo in the Netlify dashboard — `netlify.toml` at the root already configures the build command and publish directory.

After deploying, add your new SPA URL to `ALLOWED_ORIGINS` in `proxy/wrangler.toml` and redeploy the proxy.

## Other commands

```sh
npm run lint        # oxlint
npm run lint:fix    # oxlint --fix
npm run format      # oxfmt
npm run test        # Vitest (unit tests, run once)
npm run test:watch  # Vitest in watch mode
npm run preview     # serve the production build locally
```

## Security model

- **Key never leaves the device.** The `.pem` is imported as `extractable: false`; raw bytes are unrecoverable by JS after import.
- **CORS proxy trust boundary.** The shared proxy at `proxy.lommin.no` can observe transaction data and short-lived access tokens in transit. It never receives the signing key. For full privacy, deploy your own proxy and configure it in Settings.
- **Encrypted backup.** AES-GCM with PBKDF2-derived keys; the passphrase never leaves the device.
- **CSP.** `script-src 'self'` (no inline/eval). `connect-src` permits any HTTPS origin so users can configure a custom proxy at runtime. The CSP is in `public/_headers` — update `connect-src` there if you change the proxy URL.
