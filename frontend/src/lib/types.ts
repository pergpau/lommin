export interface AccountSource {
  type: "enableBanking" | "spiir" | "demo" | "manual";
  sourceId: string; // Enable Banking account UID or Spiir accountId
  sessionId?: string; // Enable Banking session ID
}

export interface Account {
  uid: string; // Internal UUID — never an external API ID
  name?: string;
  bankName?: string;
  bankCountry?: string;
  currency?: string;
  iban?: string;
  bban?: string;
  identificationHash?: string;
  identificationHashes?: string[];
  addedAt: number;
  balance?: number;
  balanceFetchedAt?: number;
  sources: AccountSource[];
  ownershipShare?: number;
}

export function getEnableBankingSource(acc: Account): AccountSource | undefined {
  return acc.sources.find((s) => s.type === "enableBanking");
}

export function normalizeBban(bban: string): string {
  return bban.replace(/\D/g, "");
}

export interface AccountIdentity {
  iban?: string;
  bban?: string;
  identificationHash?: string;
  // An external source the account may already be attached to.
  source?: Pick<AccountSource, "type" | "sourceId">;
}

// Finds the stored account that is the same real-world account as `candidate`:
// same identification hash, same IBAN, same BBAN (digits only), or already
// attached to the same external source. Used when connecting a bank or
// importing so an account is not created twice.
export function findMatchingAccount(
  existing: Account[],
  candidate: AccountIdentity,
): Account | undefined {
  const { iban, bban, identificationHash, source } = candidate;
  return existing.find(
    (acc) =>
      (!!identificationHash && acc.identificationHash === identificationHash) ||
      (!!iban && acc.iban === iban) ||
      (!!bban && !!acc.bban && normalizeBban(acc.bban) === normalizeBban(bban)) ||
      (!!source &&
        acc.sources.some((s) => s.type === source.type && s.sourceId === source.sourceId)),
  );
}

export interface Transaction {
  id: string; // composite: `${account_uid}::${entry_reference}`
  accountUid: string;
  entryReference: string;
  bookingDate: string;
  transactionDate: string;
  customDate?: string;
  amount: number;
  currency: string;
  creditDebit?: "CRDT" | "DBIT";
  description: string;
  creditorName?: string;
  bankTransactionCode?: string;
  btcCode?: string;
  status: string;
  categoryId?: number;
  excludeFromCalculations: boolean;
  comment?: string;
  to_bban?: string;
  from_bban?: string;
  matchDescription?: string;
  raw: Record<string, unknown>;
}

export interface SyncCursor {
  accountUid: string;
  lastBookingDate: string;
  updatedAt: number;
}

export function makeTransactionId(accountUid: string, entryReference: string): string {
  return `${accountUid}::${entryReference}`;
}

export function normalizeForMatch(text: string): string {
  return text
    .replace(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*/, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}
