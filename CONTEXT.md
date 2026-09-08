# Domain glossary

- **Shared account** — an account with an ownership share set; jointly owned with someone outside the app.
- **Ownership share** — the fraction of a shared account's activity attributed to the user (`Account.ownershipShare`, e.g. 0.5).
- **Personal view** — the default dashboard perspective: every account, shared ones counted at the user's ownership share ("my economy").
- **Shared view (Felles)** — the shared accounts in isolation at full value ("our economy on the joint accounts").
- **Internal transfer (Overføring)** — money moving between two tracked accounts; excluded from all calculations in every view.
- **Perspective** — the mode a Transaction view is built in: `personal` (every account, shared ones at the user's ownership share), `shared` (Shared accounts only, full value), or `full` (the given accounts at full value; used by a single account's page).
- **Transaction view** — the module (`lib/transactionView.ts`) that turns accounts + transactions + a perspective into scoped, scaled, exclusion-applied transactions and every aggregation the UI shows (monthly/yearly bars, category breakdown, per-period lists).
