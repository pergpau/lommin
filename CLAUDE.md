# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Lommin** — a privacy-first, frontend-only personal spending tracker that connects to [Enable Banking](https://enablebanking.com/). No shared backend; all sensitive data stays on-device. The app is deployed as a static SPA to Netlify; the only server-side component is a stateless CORS proxy (Cloudflare Worker).

## Repository layout

```
frontend/   React + Vite SPA (the main app)
proxy/      Cloudflare Worker — stateless CORS relay to api.enablebanking.com
PLAN.md     Original architecture and feasibility notes (historical context)
```

## Commands

### Frontend (`cd frontend` first)

```sh
npm run dev       # dev server (localhost:5173)
npm run build     # TypeScript check + Vite production build
npm run lint      # oxlint (not ESLint)
npm run lint:fix  # oxlint --fix
npm run format    # oxfmt formatter
npm run test      # Vitest (unit tests)
npm run preview   # preview the production build locally
```

### Proxy (`cd proxy` first)

```sh
wrangler dev      # local dev (localhost origins always allowed)
wrangler deploy   # deploy to Cloudflare Workers
```

## Frontend architecture

The app is a React 19 SPA with React Router v7, Tailwind CSS, and no state management library. All persistence is client-side via two separate IndexedDB databases:

- **`lommin-data`** (`src/lib/store.ts`) — accounts, transactions, sync cursors. Transactions are keyed by `${accountUid}::${entryReference}`; upserts ignore duplicates.
- **`lommin-settings`** (`src/lib/settings.ts`) — `proxyUrl`, `lookbackDays`, `usePassphrase`, `backupMethod` (`"file" | "drive"`), `driveAutosave`, `lastLocalSavedAt`. Also stores Google Drive access token/expiry.
- **`lommin-keystore`** (`src/lib/auth.ts`) — stores the non-extractable `CryptoKey` + `appId`.

### `src/lib/` — core logic

| File                 | Responsibility                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `auth.ts`            | PEM parsing, RS256 JWT minting, CryptoKey import + IndexedDB persistence (keystore)               |
| `enableBanking.ts`   | Enable Banking API client; routes all calls through the proxy                                      |
| `store.ts`           | IndexedDB CRUD for accounts, transactions, sync cursors                                            |
| `mutations.ts`       | Re-exports store write functions wrapped to trigger autosave — **use this instead of `store.ts`** |
| `settings.ts`        | IndexedDB CRUD for app settings (proxy URL, lookback days, backup method, Drive token, etc.)      |
| `cryptoFile.ts`      | AES-GCM encrypted file export/import via File System Access API (PBKDF2 key derivation)           |
| `sync.ts`            | Orchestrates a full sync: paginated transaction fetch → upsert → cursor update                    |
| `format.ts`          | Number/date formatting helpers                                                                     |
| `categories.ts`      | Norwegian category taxonomy (`MAIN_CATEGORIES`); `CategoryType`: income/expense/saving/exclude    |
| `categoryIcons.ts`   | Maps category IDs to Font Awesome icons                                                            |
| `autoCategorize.ts`  | Guesses category from `bankTransactionCode` (BTC rules) and description patterns                  |
| `autosave.ts`        | Debounced (3 s) autosave to Google Drive; `triggerAutosave()` / `addSaveListener()`               |
| `googleDrive.ts`     | Google Drive backup/restore using `drive.appdata` scope; `DriveAuthError` for token expiry        |
| `spiirImport.ts`     | Parse Spiir ZIP export → Accounts + Transactions; maps Spiir category IDs to own IDs             |
| `transfers.ts`       | `detectTransfers()` — greedy same-amount opposite-sign matcher across accounts (±3 days)          |
| `i18n.ts`            | i18next setup; Norwegian (`nb`) + English (`en`); auto-detects browser language                   |
| `theme.ts`           | Dark/light theme toggle; persisted in `localStorage`; `ThemeContext`                              |
| `validate.ts`        | Runtime validation guards for external data (API responses, import files); no Zod dependency      |
| `demoData.ts`        | Seeds two demo accounts with synthetic transactions for the demo onboarding flow                  |

### `src/hooks/` — data hooks for pages

- `useAccounts`, `useTransactions`, `useSyncState` — thin wrappers over the IndexedDB store that load data on mount and expose loading/error state
- `useAsyncData<T>(fetcher, initial, deps)` — generic async data hook with loading/error/reload; prefer this over bespoke hooks
- `useSuccessFlash(duration?)` — returns `{ success, flash }` for transient success animation state

### Pages and routing

`/onboarding` → `/connect` → `/dashboard` / `/account/:uid` / `/settings`
(`/setup` redirects to `/onboarding`)

`RequireKey` (in `App.tsx`) guards dashboard/account/settings routes — redirects to `/onboarding` if neither a signing key nor any accounts exist. Accounts can exist without a key (demo mode, Spiir import).

Additional routes: `/oauth/google` (Google Drive OAuth callback), `/privacy`, `/terms`.

### i18n

All user-facing strings are in `src/locales/{nb,en}/*.json`. Use `useTranslation()` from `react-i18next`; namespace matches the JSON file name (e.g. `t('key', { ns: 'dashboard' })`).

### Mutations vs. store

For any write that modifies user data, import from `src/lib/mutations.ts` (not `store.ts`). `mutations.ts` wraps each write to debounce-trigger autosave. Exception: `sync.ts`, which batches writes and triggers autosave itself via its callback.

### Account and Transaction models

`Account.sources: AccountSource[]` — each account can have multiple sources. `AccountSource.type` is `"enableBanking" | "spiir" | "demo"`. Use `getEnableBankingSource(acc)` to get the Enable Banking source. Spiir and demo accounts have no signing key requirement.

`Transaction` additional fields beyond the Enable Banking basics: `categoryId` (number), `isExtraordinary` (boolean), `comment` (string), `customDate` (string), `to_bban`, `from_bban`.

### Demo mode

`demoData.ts#seedDemoData()` creates two local accounts with synthetic transactions. Triggered from the onboarding flow. Demo accounts have `source.type === "demo"` and no sync capability.

### Testing

Unit tests use Vitest (`npm run test`). Test files live alongside source: `*.test.ts`. Existing tests: `autoCategorize.test.ts`, `cryptoFile.test.ts`, `jwt.test.ts`, `spiirImport.test.ts`, `transfers.test.ts`, `validate.test.ts`.

### Constants (`src/constants.ts`)

`JWT_LIFETIME_SECONDS = 300` — JWTs are short-lived (5 min). A new JWT is minted per API call via `mintJwt()`.

## CORS proxy (`proxy/worker.ts`)

Single-file Cloudflare Worker (~130 lines). Key constraints:
- **Origin allowlist**: set `ALLOWED_ORIGINS` (comma-separated) in `wrangler.toml`; localhost always allowed.
- **Path allowlist**: only `/aspsps`, `/auth`, `/sessions`, `/accounts/:id/transactions`, `/accounts/:id/balances` are forwarded.
- **Rate limiting**: 60 req/min per IP (hashed SHA-256 IP stored in KV). KV binding `RATE_LIMIT_KV` must exist; if not bound (local dev), rate limiting is skipped.
- Forwards only `Authorization` and `Content-Type` headers upstream; drops everything else.

To add a new Enable Banking endpoint, add a regex to `PATH_ALLOWLIST` in `worker.ts`.

## Enable Banking auth flow

1. `GET /aspsps?country=NO` — list banks
2. `POST /auth` — get consent URL; store `state` for CSRF check
3. Browser navigates to consent URL (top-level redirect, not CORS)
4. Bank redirects back to SPA with `?code=&state=`; verify `state`, call `POST /sessions`
5. `GET /accounts/:uid/transactions?date_from=...` — paginated via `continuation_key`

## Security invariants

- The `.pem` key is imported as `extractable: false` — raw bytes are unrecoverable from JS after import.
- The proxy never receives the `.pem`; it only sees the already-signed JWT (5-min validity).
- Encrypted sync files use AES-GCM with PBKDF2-derived keys; the plaintext never leaves the device.
- The `_headers` file (in `frontend/public/`) sets CSP `connect-src` — update it if you change the proxy URL.

## Icons

Always use **Font Awesome** for icons (`@fortawesome/react-fontawesome` + `@fortawesome/free-solid-svg-icons`). Do not create custom SVG icons. Use `<FontAwesomeIcon icon={faXxx} />` directly at the call site. The custom icon wrappers in `src/components/ui/icons.tsx` are legacy and should not be extended.

## Deployment

- **Frontend**: `npm run build` → deploy `frontend/dist/` to Netlify. The `public/_redirects` catch-all (`/* /index.html 200`) handles SPA routing.
- **Proxy**: `wrangler deploy` from `proxy/`. Add the new Worker URL to `ALLOWED_ORIGINS` in `wrangler.toml` and to CSP `connect-src` in `frontend/public/_headers`.
- The redirect URL registered in the Enable Banking control panel must match the deployed SPA URL exactly.
