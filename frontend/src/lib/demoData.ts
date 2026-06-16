import { getAccounts, saveAccount, upsertTransactions, type Account, type Transaction } from "./store";

const BRUKSKONTO_UID = "demo-brukskonto";
const KREDITTKORT_UID = "demo-kredittkort";

function monthDate(monthsAgo: number, day: number): string {
  const dt = new Date();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() - monthsAgo);
  dt.setDate(day);
  return dt.toISOString().slice(0, 10);
}

function tx(
  accountUid: string,
  ref: string,
  date: string,
  amount: number,
  description: string,
  categoryId?: number,
): Transaction {
  return {
    id: `${accountUid}::${ref}`,
    accountUid,
    entryReference: ref,
    bookingDate: date,
    amount,
    currency: "NOK",
    creditDebit: amount > 0 ? "CRDT" : "DBIT",
    description,
    status: "BOOK",
    categoryId,
    raw: {},
  };
}

const ACCOUNTS: Account[] = [
  {
    uid: BRUKSKONTO_UID,
    name: "Brukskonto",
    bankName: "DnB",
    bankCountry: "NO",
    currency: "NOK",
    bban: "12345678903",
    addedAt: Date.now(),
    balance: 45000,
    sources: [{ type: "demo", sourceId: "demo" }],
  },
  {
    uid: KREDITTKORT_UID,
    name: "Kredittkort",
    bankName: "Sbanken",
    bankCountry: "NO",
    currency: "NOK",
    addedAt: Date.now(),
    balance: -3200,
    sources: [{ type: "demo", sourceId: "demo" }],
  },
];

function buildTransactions(): Transaction[] {
  const B = BRUKSKONTO_UID;
  const K = KREDITTKORT_UID;
  const txns: Transaction[] = [];

  for (const m of [2, 1, 0] as const) {
    txns.push(tx(B, `salary-${m}`, monthDate(m, 25), 42000, "Lønn", 103));
    txns.push(tx(B, `rent-${m}`, monthDate(m, 1), -15500, "Husleie", 114));
    txns.push(tx(B, `electricity-${m}`, monthDate(m, 5), -890, "Strøm og Energi", 115));
    txns.push(tx(B, `rema-a-${m}`, monthDate(m, 8), -650, "Rema 1000", 133));
    txns.push(tx(B, `kiwi-${m}`, monthDate(m, 12), -380, "Kiwi", 133));
    txns.push(tx(B, `rema-b-${m}`, monthDate(m, 20), -520, "Rema 1000", 133));
    txns.push(tx(B, `tog-${m}`, monthDate(m, 15), -445, "Vy", 128));
    txns.push(tx(B, `spotify-${m}`, monthDate(m, 10), -109, "Spotify", 146));
    txns.push(tx(B, `netflix-${m}`, monthDate(m, 14), -179, "Netflix", 146));
    txns.push(tx(K, `ruter-${m}`, monthDate(m, 3), -895, "Ruter", 128));
    txns.push(tx(K, `internett-${m}`, monthDate(m, 5), -599, "Internettabonnement", 147));
  }

  // One-off transactions for variety
  txns.push(tx(B, "apotek-1", monthDate(1, 20), -245, "Apotek 1", 142));
  txns.push(tx(B, "burger-2", monthDate(2, 22), -189, "Burger King", 155));
  txns.push(tx(B, "restaurant-1", monthDate(1, 18), -580, "Illegal Burger", 156));
  txns.push(tx(K, "hm-2", monthDate(2, 10), -1290, "H&M", 157));
  txns.push(tx(K, "hm-1", monthDate(1, 12), -670, "H&M", 157));
  txns.push(tx(K, "ikea-2", monthDate(2, 15), -2340, "IKEA", 158));
  txns.push(tx(K, "amazon-1", monthDate(1, 8), -399, "Amazon", 168));
  txns.push(tx(K, "amazon-0", monthDate(0, 20), -249, "Amazon", 168));
  txns.push(tx(K, "zalando-1", monthDate(1, 14), -895, "Zalando", 157));
  txns.push(tx(K, "clas-0", monthDate(0, 18), -549, "Clas Ohlson", 159));
  txns.push(tx(K, "vinmonopolet-1", monthDate(1, 22), -459, "Vinmonopolet", 169));

  return txns;
}

export async function seedDemoData(): Promise<void> {
  for (const acc of ACCOUNTS) {
    await saveAccount(acc);
  }
  await upsertTransactions(buildTransactions());
}

export async function isDemoMode(): Promise<boolean> {
  const accounts = await getAccounts();
  if (accounts.length === 0) return false;
  return accounts.every(
    (acc) => acc.sources.length > 0 && acc.sources[0].type === "demo",
  );
}
