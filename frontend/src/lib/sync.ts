import { t } from "i18next";
import { guessCategory } from "./autoCategorize";
import {
  fetchAllTransactions,
  fetchBalance,
  ProxyNetworkError,
  SessionExpiredError,
} from "./enableBanking";
import { getSetting } from "./settings";
import {
  getAllTransactions,
  getEnableBankingSource,
  getSyncCursor,
  saveAccount,
  setSyncCursor,
  tagTransferCategory,
  upsertTransactions,
  type Account,
  type Transaction,
} from "./data";
import { detectTransfers } from "./transfers";

function dateFromDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

interface FetchedAccount {
  acc: Account;
  txns: Transaction[];
  balance: number | undefined;
}

// Fetch one account's new transactions + balance from its cursor (overlap 2 days) or
// configured history period. Does not categorize or persist anything.
async function fetchAccountData(
  acc: Account,
  onProgress?: (msg: string) => void,
  forcedDateFrom?: string,
): Promise<FetchedAccount> {
  const bankName = acc.bankName ?? "";
  const label = acc.name ?? acc.uid.slice(0, 8);
  const src = getEnableBankingSource(acc);
  if (!src) return { acc, txns: [], balance: undefined }; // Spiir-only account — nothing to sync via API

  let dateFrom: string;
  if (forcedDateFrom) {
    dateFrom = forcedDateFrom;
  } else {
    const cursor = await getSyncCursor(acc.uid);
    const defaultDateFrom = dateFromDaysAgo(await getSetting("lookbackDays"));
    dateFrom = cursor?.lastBookingDate
      ? new Date(new Date(cursor.lastBookingDate).getTime() - 2 * 86400_000)
          .toISOString()
          .split("T")[0]
      : defaultDateFrom;
  }

  const apiUid = src.sourceId;
  onProgress?.(`${t("actions.syncing")}: ${bankName} (${label})`);
  const [txns, balance] = await Promise.all([
    fetchAllTransactions(
      apiUid,
      dateFrom,
      (n) => onProgress?.(`${t("actions.syncing")}: ${bankName} (${label}) (${n})`),
      acc.uid,
    ),
    fetchBalance(apiUid).catch(() => undefined),
  ]);

  return { acc, txns, balance };
}

export interface SyncResult {
  inserted: number;
  errors: Array<{
    uid: string;
    label: string;
    message: string;
    isNetworkError: boolean;
    isSessionExpired: boolean;
  }>;
}

// Sync many accounts in parallel. Continues on per-account errors.
export async function syncAccounts(
  accounts: Account[],
  onProgress?: (msg: string) => void,
  forcedDateFrom?: string,
): Promise<SyncResult> {
  let inserted = 0;
  const errors: SyncResult["errors"] = [];

  const results = await Promise.all(
    accounts.map(async (acc) => {
      try {
        return {
          fetched: await fetchAccountData(acc, onProgress, forcedDateFrom),
          acc,
          error: null,
        };
      } catch (e) {
        return { fetched: null, acc, error: e };
      }
    }),
  );

  const ok = results.filter(
    (r): r is { fetched: FetchedAccount; acc: Account; error: null } => r.error === null,
  );
  for (const { acc, error } of results) {
    if (error !== null) {
      errors.push({
        uid: acc.uid,
        label: acc.name ?? acc.uid.slice(0, 8),
        message: error instanceof Error ? error.message : String(error),
        isNetworkError: error instanceof ProxyNetworkError,
        isSessionExpired: error instanceof SessionExpiredError,
      });
    }
  }

  // Detect transfers across the combined new+existing set before categorizing anything,
  // so a transfer where both legs are being synced for the first time (across two
  // different accounts, in the same operation) is still recognized and takes priority
  // over creditor/bban history and rule matching.
  const existing = await getAllTransactions();
  const creditorHistory = new Map<string, number>();
  const bbanHistory = new Map<string, number>();
  for (const t of existing) {
    if (t.creditorName && t.categoryId !== undefined)
      creditorHistory.set(t.creditorName, t.categoryId);
    if (t.categoryId !== undefined && (t.to_bban || t.from_bban)) {
      bbanHistory.set(`${t.from_bban ?? ""}→${t.to_bban ?? ""}`, t.categoryId);
    }
  }
  const allNewTxns = ok.flatMap((r) => r.fetched.txns);
  const transferIds = detectTransfers([...existing, ...allNewTxns]);

  for (const { fetched, acc } of ok) {
    const { txns, balance } = fetched;
    const categorized = txns.map((tx) => ({
      ...tx,
      categoryId: tx.categoryId ?? guessCategory(tx, creditorHistory, bbanHistory, transferIds),
    }));
    inserted += await upsertTransactions(categorized);

    if (balance !== undefined) {
      await saveAccount({ ...acc, balance, balanceFetchedAt: Date.now() });
    }

    if (txns.length > 0) {
      const latest = txns
        .map((t) => t.bookingDate)
        .filter(Boolean)
        .sort()
        .pop();
      if (latest) await setSyncCursor(acc.uid, latest);
    }
  }

  const allTxns = await getAllTransactions();
  await tagTransferCategory(detectTransfers(allTxns));

  return { inserted, errors };
}
