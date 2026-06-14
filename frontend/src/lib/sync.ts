import { fetchAllTransactions, fetchBalance } from './enableBanking'
import {
  getSyncCursor,
  setSyncCursor,
  saveAccount,
  upsertTransactions,
  getAllTransactions,
  markTransfers,
  getEnableBankingSource,
  type Account,
} from './store'
import { detectTransfers } from './transfers'
import { guessCategory } from './autoCategorize'
import { getSetting } from './settings'

function dateFromDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// Sync one account: fetch from its cursor (overlap 2 days) or configured history period,
// upsert, advance cursor. Returns count of newly inserted transactions.
export async function syncAccount(
  acc: Account,
  onProgress?: (msg: string) => void,
): Promise<number> {
  const label = acc.name ?? acc.uid.slice(0, 8)
  const src = getEnableBankingSource(acc)
  if (!src) return 0  // Spiir-only account — nothing to sync via API

  const cursor = await getSyncCursor(acc.uid)
  const defaultDateFrom = dateFromDaysAgo(await getSetting('lookbackDays'))
  const dateFrom = cursor?.lastBookingDate
    ? new Date(new Date(cursor.lastBookingDate).getTime() - 2 * 86400_000).toISOString().split('T')[0]
    : defaultDateFrom

  const apiUid = src.sourceId
  onProgress?.(`Fetching ${label}…`)
  const [txns, balance] = await Promise.all([
    fetchAllTransactions(apiUid, dateFrom, (n) => onProgress?.(`Fetching ${label}… (${n})`), acc.uid),
    fetchBalance(apiUid).catch(() => undefined),
  ])

  const existing = await getAllTransactions()
  const creditorHistory = new Map<string, number>()
  for (const t of existing) {
    const name = t.raw.creditor as Record<string, unknown> | undefined
    const creditorName = name?.name as string | undefined
    if (creditorName && t.categoryId !== undefined) creditorHistory.set(creditorName, t.categoryId)
  }
  const categorized = txns.map((tx) => ({
    ...tx,
    categoryId: tx.categoryId ?? guessCategory(tx, creditorHistory),
  }))
  const inserted = await upsertTransactions(categorized)

  if (balance !== undefined) {
    await saveAccount({ ...acc, balance, balanceFetchedAt: Date.now() })
  }

  if (txns.length > 0) {
    const latest = txns
      .map((t) => t.bookingDate ?? t.transactionDate ?? '')
      .filter(Boolean)
      .sort()
      .pop()
    if (latest) await setSyncCursor(acc.uid, latest)
  }

  return inserted
}

export interface SyncResult {
  inserted: number
  errors: Array<{ uid: string; label: string; message: string }>
}

// Sync many accounts in parallel. Continues on per-account errors.
export async function syncAccounts(
  accounts: Account[],
  onProgress?: (msg: string) => void,
): Promise<SyncResult> {
  let inserted = 0
  const errors: SyncResult['errors'] = []

  const results = await Promise.all(
    accounts.map(async (acc) => {
      try {
        return { inserted: await syncAccount(acc, onProgress), acc, error: null }
      } catch (e) {
        return { inserted: 0, acc, error: e }
      }
    }),
  )

  for (const { inserted: n, acc, error } of results) {
    if (error === null) {
      inserted += n
    } else {
      errors.push({
        uid: acc.uid,
        label: acc.name ?? acc.uid.slice(0, 8),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  onProgress?.('Oppdaterer overføringer…')
  const allTxns = await getAllTransactions()
  await markTransfers(detectTransfers(allTxns))

  return { inserted, errors }
}
