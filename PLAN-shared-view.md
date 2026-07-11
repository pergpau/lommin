# Shared-accounts view (Felles) on the Dashboard

## Context

Accounts can be marked shared via `Account.ownershipShare` (e.g. 0.5). The Dashboard scales those accounts' transactions by the share so all charts answer "what is _my_ spending". The user (who has two joint accounts with his wife) also wants the opposite perspective: the joint accounts **in isolation, at full value** — "what is _our_ spending on the shared accounts" — using the same MonthlyChart + SpendingBreakdown surfaces.

## Decisions (settled in grilling session)

- **Dedicated shared view**, not a general account filter. Two well-defined perspectives:
  - **Personal view** (default, current behavior): all accounts, shared ones scaled by `ownershipShare`.
  - **Shared view**: only accounts with `ownershipShare != null`, amounts at 100% (no `shareMap` applied — the "shared 50%" row badges naturally disappear, which is correct).
- **Membership is automatic**: `ownershipShare` set ⇒ in the shared view. No selection UI or new persisted state.
- **Switch lives on the Dashboard** as a segmented control (Personlig | Felles), stored as `?view=shared` alongside the existing `?tab=` param. Rendered only when at least one shared account exists.
- **Scope data, keep actions global**: chart, categories tab, transactions tab, accounts tab, and the header subtitle counts are all scoped to the shared accounts in shared view. Sync/save/backup stay global.
- **No special income logic**: the shared view is purely _filter + full amounts_. Category semantics unchanged — auto-tagged internal transfers (category 100 «Overføring», type exclude) stay excluded in every view. The wife's contributions arriving as income are the user's categorization concern, not new code.
- **Naming**: nb «Personlig» / «Felles», en "Personal" / "Shared".

## Changes

### 1. `frontend/src/pages/Dashboard.tsx` (the bulk of the work)

- Derive `sharedAccounts = accounts.filter(a => a.ownershipShare != null)` and `hasShared = sharedAccounts.length > 0`.
- Derive view from URL: `view: "personal" | "shared"` = `searchParams.get("view") === "shared" && hasShared ? "shared" : "personal"`. Falls back to personal (and hides the toggle) if no shared accounts exist — handles a stale `?view=shared` URL.
- **Param preservation**: the existing `setTab` does `setSearchParams({ tab })`, which would drop `view`. Both `setTab` and the new `setView` must merge with the other param (keep `tab` when setting `view` and vice versa).
- Scope the data once, upstream of everything:
  - `scopedTransactions` = all transactions (personal) or filtered to shared account uids (shared).
  - `scopedAccounts` = `accounts` or `sharedAccounts` — feeds `AccountsTab` and the header subtitle counts.
  - Chart input: personal view keeps today's `scaledTransactions` (shareMap applied); shared view feeds `scopedTransactions` unscaled into `buildMonthlyData`/`buildYearlyData`.
  - `recent` and `txByAccount` computed from `scopedTransactions`.
  - Pass `shareMap` to `SpendingBreakdown`/`TransactionsTab` only in personal view (`undefined` in shared view).
- Toggle UI: segmented control styled like MonthlyChart's month/year `modeToggle` (`Dashboard` header area, above the chart), only rendered when `hasShared`. No new components needed.
- `selectedMonth` needs no special handling on toggle — `activeMonth` already falls back to the last bar when the key is missing.

### 2. Locales

`frontend/src/locales/nb/dashboard.json` and `en/dashboard.json`: add e.g. `view.personal` («Personlig» / "Personal") and `view.shared` («Felles» / "Shared").

### 3. `CONTEXT.md` (new, repo root — domain glossary)

Create with the terms resolved in this session:

- **Shared account** — an account with an ownership share set; jointly owned with someone outside the app.
- **Ownership share** — the fraction of a shared account's activity attributed to the user.
- **Personal view** — the default dashboard perspective: every account, shared ones counted at the user's ownership share ("my economy").
- **Shared view (Felles)** — the shared accounts in isolation at full value ("our economy on the joint accounts").
- **Internal transfer (Overføring)** — money moving between two tracked accounts; excluded from all calculations in every view.

No ADR — the choice is UI-level and cheap to reverse.

## Not touched

- No changes to `lib/` (aggregation, transfers, categories, store) — this is page-level wiring only.
- Account page, sync flow, backup, duplicates unaffected.

## Verification

- `cd frontend && npm run build && npm run lint && npm run test` (no new unit tests needed — no new lib logic).
- Manual check is the user's (per project convention): toggle appears only when a shared account exists; shared view shows full amounts and no 50% badges; `?tab=` and `?view=` survive each other; refresh/back preserve the view.
