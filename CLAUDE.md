# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Lommin** — a privacy-first, self-hosted personal spending tracker that connects to [Enable Banking](https://enablebanking.com/). No shared backend; all sensitive data stays on-device. The app is a static SPA deployed by the user to any static host; the only server-side component is a stateless CORS proxy (f.ex. Cloudflare Worker) also deployed by the user.

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
npm run format:check # oxfmt --check (no writes)
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

- **`lommin-data`** (`src/lib/store.ts`, accessed via `data.ts`) — accounts, transactions, sync cursors. Transactions are keyed by `${accountUid}::${entryReference}`; upserts ignore duplicates.
- **`lommin-settings`** (`src/lib/settings.ts`) — `proxyUrl`, `lookbackDays`, `usePassphrase`, `backupMethod` (`"file" | "drive"`), `driveAutosave`, `lastLocalSavedAt`. Also stores Google Drive access token/expiry.
- **`lommin-keystore`** (`src/lib/auth.ts`) — stores the non-extractable `CryptoKey` + `appId`.

### `src/lib/` — core logic

| File                        | Responsibility                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`                   | PEM parsing, RS256 JWT minting, CryptoKey import + IndexedDB persistence (keystore)                                                      |
| `enableBanking.ts`          | Enable Banking API client; routes all calls through the proxy                                                                            |
| `types.ts`                  | Data type definitions (`Account`, `Transaction`, `SyncCursor`) and pure helpers                                                          |
| `store.ts`                  | IndexedDB CRUD for accounts, transactions, sync cursors — **do not import directly**                                                     |
| `data.ts`                   | Public data interface: all writes (with autosave), reads, and type re-exports                                                            |
| `settings.ts`               | IndexedDB CRUD for app settings (proxy URL, lookback days, backup method, Drive token, etc.)                                             |
| `cryptoFile.ts`             | AES-GCM encrypted file export/import via File System Access API (PBKDF2 key derivation)                                                  |
| `sync.ts`                   | Orchestrates a full sync: paginated transaction fetch → upsert → cursor update                                                           |
| `format.ts`                 | Number/date formatting helpers                                                                                                           |
| `categories.ts`             | Norwegian category taxonomy (`MAIN_CATEGORIES`); `CategoryType`: income/expense/saving/exclude                                           |
| `categoryIcons.ts`          | Maps category IDs to Font Awesome icons                                                                                                  |
| `autoCategorize.ts`         | Guesses category from `bankTransactionCode` (BTC rules) and description patterns                                                         |
| `backup.ts`                 | The backup pipeline: `saveBackup`/`loadBackup`/`applyRestore`, debounced Drive autosave, `assessDriveSync`, `BackupError` classification |
| `googleDrive.ts`            | Google Drive backup/restore using `drive.appdata` scope; `DriveAuthError` for token expiry                                               |
| `spiirImport.ts`            | Parse Spiir ZIP export → Accounts + Transactions; maps Spiir category IDs to own IDs                                                     |
| `csvImport.ts`              | Parse generic CSV export → transaction drafts, with auto-categorization via `autoCategorize.ts`                                          |
| `transfers.ts`              | `detectTransfers()` — greedy same-amount opposite-sign matcher across accounts (±3 days)                                                 |
| `duplicates.ts`             | Heuristics to flag likely-duplicate transactions (same-day/near-day, food-category, etc.)                                                |
| `similarTransactions.ts`    | `findSimilarUncategorized()` — finds other uncategorized transactions matching by creditor, bban pair, or auto-categorize rule           |
| `transactionAggregation.ts` | `txSection()` and related helpers — classifies/aggregates transactions into income/expense/saving for charts                             |
| `i18n.ts`                   | i18next setup; Norwegian (`nb`) + English (`en`); auto-detects browser language                                                          |
| `theme.ts`                  | Dark/light theme toggle; persisted in `localStorage`; `ThemeContext`                                                                     |
| `validate.ts`               | Runtime validation guards for external data (API responses, import files); no Zod dependency                                             |
| `demoData.ts`               | Seeds two demo accounts with synthetic transactions for the demo onboarding flow                                                         |

### `src/hooks/` — data hooks for pages

- `useAccounts`, `useTransactions`, `useSyncState` — thin wrappers over the IndexedDB store that load data on mount and expose loading/error state
- `useAsyncData<T>(fetcher, initial, deps)` — generic async data hook with loading/error/reload; prefer this over bespoke hooks
- `useSuccessFlash(duration?)` — returns `{ success, flash }` for transient success animation state
- `useDriveSync()` — Drive restore-conflict flow: assesses local vs. remote state, prompts confirm/cancel, applies restore
- `useSimilarSuggestions()` — bulk-categorize suggestions built on `similarTransactions.ts`
- `useSwipe(options)` — touch swipe-direction detection (used for swipe-to-navigate/dismiss)
- `useDragScrollStrip()` — pointer-drag horizontal scrolling for strip/carousel UI

### Pages and routing

`/onboarding` → `/connect` → `/dashboard` / `/account/:uid` / `/settings` / `/duplicates`
(`/setup` redirects to `/onboarding`)

`RequireKey` (in `App.tsx`) guards dashboard/account/settings/duplicates routes — redirects to `/onboarding` if neither a signing key nor any accounts exist. Accounts can exist without a key (demo mode, Spiir import).

Additional routes: `/oauth/google` (Google Drive OAuth callback), `/privacy-terms` (`/privacy` and `/terms` redirect here).

### i18n

All user-facing strings are in `src/locales/{nb,en}/*.json`. Use `useTranslation()` from `react-i18next`; namespace matches the JSON file name (e.g. `t('key', { ns: 'dashboard' })`).

### Data access: data.ts is the public interface

Import all data operations from `src/lib/data.ts` — never import `store.ts` directly. `data.ts` wraps every write with debounced autosave (3 s) and re-exports all reads and types. For type-only imports in `src/lib/` files, import from `src/lib/types.ts` to avoid depending on the persistence layer. The only file that may import `store.ts` directly (besides `data.ts`) is `backup.ts`, to avoid a circular dependency.

### Account and Transaction models

`Account.sources: AccountSource[]` — each account can have multiple sources. `AccountSource.type` is `"enableBanking" | "spiir" | "demo"`. Use `getEnableBankingSource(acc)` to get the Enable Banking source. Spiir and demo accounts have no signing key requirement.

`Transaction` additional fields beyond the Enable Banking basics: `categoryId` (number), `excludeFromCalculations` (boolean), `comment` (string), `customDate` (string), `to_bban`, `from_bban`, `matchDescription`.

### Demo mode

`demoData.ts#seedDemoData()` creates two local accounts with synthetic transactions. Triggered from the onboarding flow. Demo accounts have `source.type === "demo"` and no sync capability.

### Testing

Unit tests use Vitest (`npm run test`). Test files live alongside source: `*.test.ts`. Existing tests: `auth.test.ts`, `autoCategorize.test.ts`, `backup.test.ts`, `cryptoFile.test.ts`, `csvImport.test.ts`, `similarTransactions.test.ts`, `spiirImport.test.ts`, `store.test.ts`, `transactionAggregation.test.ts`, `transfers.test.ts`, `validate.test.ts`.

Do not start the dev server or drive the app in a browser to test changes — the user does this themselves. Rely on `npm run build`, `npm run lint`, and `npm run test` to verify correctness.

### Constants (`src/constants.ts`)

`JWT_LIFETIME_SECONDS = 300` — JWTs are short-lived (5 min). A new JWT is minted per API call via `mintJwt()`.

## CORS proxy (`proxy/worker.ts`)

Single-file Cloudflare Worker (~190 lines). Key constraints:

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
- The `_headers` file (in `frontend/public/`) sets CSP `connect-src 'self' https:` — any HTTPS proxy origin is allowed, so no edit is needed when the proxy URL changes. Tighten it only if you want a stricter per-origin allowlist.

## Icons

Always use **Font Awesome** for icons (`@fortawesome/react-fontawesome` + `@fortawesome/free-solid-svg-icons`). Do not create custom SVG icons. Use `<FontAwesomeIcon icon={faXxx} />` directly at the call site. The custom icon wrappers in `src/components/ui/icons.tsx` are legacy and should not be extended.

## Deployment

- **Frontend**: `npm run build` → deploy `frontend/dist/` to any static host. Set `VITE_PROXY_URL` env var to your proxy Worker URL at build time. The `public/_redirects` catch-all (`/* /index.html 200`) handles SPA routing on Netlify.
- **Proxy**: `wrangler deploy` from `proxy/`. Set `ALLOWED_ORIGINS` in `wrangler.toml` to your frontend URL.
- The redirect URL registered in the Enable Banking control panel must match the deployed SPA URL exactly.
- **Demo-only instance**: build with `VITE_DEMO_ONLY=true npm run build` (leave `VITE_PROXY_URL`/`VITE_GOOGLE_CLIENT_ID` unset). The `DEMO_ONLY` constant (`src/constants.ts`) makes the app seed demo data on boot, skip onboarding, redirect `/onboarding` and `/connect` to `/dashboard`, and expose only an appearance-only Settings page — no bank/sync/backup surfaces. Detection otherwise reuses the runtime `isDemoMode()` gating.
- Self-hosters using their own reverse-proxy CSP (instead of `public/_headers`) need `frame-src 'self' https://accounts.google.com` app-wide (the iframe used for silent Drive reauth navigates to Google, which then redirects it back to the app's own origin — both hops must be allowed) and `frame-ancestors 'self'` on `/oauth/google` specifically. Harmless if omitted, it just always falls back to the visible reconnect modal.
