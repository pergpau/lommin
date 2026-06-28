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
