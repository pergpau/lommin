import { mintJwt } from "./jwt";
import { loadKey } from "./keystore";
import { getSetting } from "./settings";
import { type Transaction, makeTransactionId } from "./store";
import { asArray, asRecord, isRecord, optString, reqString } from "./validate";

async function authHeader(): Promise<string> {
  const kv = await loadKey();
  if (!kv) throw new Error("No signing key loaded. Go to Setup first.");
  const token = await mintJwt(kv.key, kv.appId);
  return `Bearer ${token}`;
}

async function proxyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const proxyUrl = await getSetting("proxyUrl");
  const base = proxyUrl.replace(/\/$/, "");
  const auth = await authHeader();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error_description ?? body.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${msg}`);
  }
  return res;
}

export interface BankEntry {
  name: string;
  country: string;
  logo?: string;
}

export async function listBanks(country: string): Promise<BankEntry[]> {
  const res = await proxyFetch(`/aspsps?country=${encodeURIComponent(country)}`);
  const data = asRecord(await res.json(), "aspsps-respons");
  return asArray(data.aspsps ?? [], "aspsps")
    .filter(isRecord)
    .map((b) => ({
      name: optString(b.name) ?? "",
      country: optString(b.country) ?? "",
      logo: optString(b.logo),
    }))
    .filter((b) => Boolean(b.name && b.country));
}

export interface InitiateAuthParams {
  aspsp: { name: string; country: string };
  redirectUrl: string;
  validUntil: string;
  state: string;
}

export async function initiateAuth(params: InitiateAuthParams): Promise<string> {
  const res = await proxyFetch("/auth", {
    method: "POST",
    body: JSON.stringify({
      aspsp: params.aspsp,
      access: { valid_until: params.validUntil },
      state: params.state,
      redirect_url: params.redirectUrl,
      psu_type: "personal",
    }),
  });
  const data = asRecord(await res.json(), "auth-respons");
  return reqString(data.url, "url");
}

export interface SessionResult {
  sessionId: string;
  accounts: {
    uid: string;
    name?: string;
    currency?: string;
    iban?: string;
    bban?: string;
    identificationHash?: string;
    identificationHashes?: string[];
  }[];
}

export async function createSession(code: string): Promise<SessionResult> {
  const res = await proxyFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const data = asRecord(await res.json(), "sessions-respons");
  return {
    sessionId: reqString(data.session_id, "session_id"),
    accounts: asArray(data.accounts ?? [], "accounts").map((item, i) => {
      const a = asRecord(item, `account[${i}]`);
      const accountId = isRecord(a.account_id) ? a.account_id : undefined;
      const other = accountId && isRecord(accountId.other) ? accountId.other : undefined;
      const bban = other?.scheme_name === "BBAN" ? optString(other.identification) : undefined;
      const iban = accountId ? optString(accountId.iban) : undefined;
      const name =
        optString(a.details) ?? optString(a.product) ?? optString(a.account_servicer_reference);
      const identificationHashes = Array.isArray(a.identification_hashes)
        ? a.identification_hashes.filter((h): h is string => typeof h === "string")
        : undefined;
      return {
        uid: reqString(a.uid, `account[${i}].uid`),
        name,
        currency: optString(a.currency),
        iban: iban || undefined,
        bban,
        identificationHash: optString(a.identification_hash),
        identificationHashes: identificationHashes?.length ? identificationHashes : undefined,
      };
    }),
  };
}

interface RawTransaction {
  entry_reference?: string;
  transaction_id?: string;
  booking_date?: string;
  transaction_date?: string;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: string;
  status?: string;
  remittance_information?: string[];
  creditor?: { name?: string };
}

// API sends a positive magnitude plus a separate indicator. Apply the sign so
// debit (money out) is negative and credit (money in) is positive.
function parseAmount(raw: RawTransaction): number {
  const n = Math.abs(parseFloat(raw.transaction_amount?.amount ?? "0"));
  return raw.credit_debit_indicator === "DBIT" ? -n : n;
}

function parseCreditDebit(raw: RawTransaction): "CRDT" | "DBIT" | undefined {
  if (raw.credit_debit_indicator === "CRDT" || raw.credit_debit_indicator === "DBIT") {
    return raw.credit_debit_indicator;
  }
  return undefined;
}

function parseDescription(raw: RawTransaction): string {
  if (raw.remittance_information?.length) return raw.remittance_information[0];
  return raw.creditor?.name ?? "";
}

// Some transactions arrive without entry_reference/transaction_id. Derive a
// deterministic key from stable fields so repeated syncs collapse to one row
// instead of inserting a fresh random id every time.
function deriveStableRef(raw: RawTransaction): string {
  const parts = [
    raw.booking_date ?? "",
    raw.transaction_date ?? "",
    raw.transaction_amount?.amount ?? "",
    raw.transaction_amount?.currency ?? "",
    parseDescription(raw),
    raw.status ?? "",
  ].join("|");
  return `gen:${parts}`;
}

export async function fetchTransactions(
  accountUid: string,
  dateFrom: string | undefined,
  continuationKey?: string,
  localUid?: string,
): Promise<{ transactions: Transaction[]; continuationKey?: string }> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (continuationKey) params.set("continuation_key", continuationKey);

  const res = await proxyFetch(
    `/accounts/${encodeURIComponent(accountUid)}/transactions?${params}`,
  );
  const data = asRecord(await res.json(), "transactions-respons");

  const txAccountUid = localUid ?? accountUid;
  const raws = asArray(data.transactions ?? [], "transactions").filter(
    isRecord,
  ) as RawTransaction[];
  const transactions: Transaction[] = raws.map((r) => {
    const ref = r.entry_reference ?? r.transaction_id ?? deriveStableRef(r);
    return {
      id: makeTransactionId(txAccountUid, ref),
      accountUid: txAccountUid,
      entryReference: ref,
      bookingDate: r.booking_date,
      transactionDate: r.transaction_date,
      amount: parseAmount(r),
      currency: r.transaction_amount?.currency ?? "",
      creditDebit: parseCreditDebit(r),
      description: parseDescription(r),
      status: r.status ?? "",
      raw: { ...r },
    };
  });

  return { transactions, continuationKey: optString(data.continuation_key) };
}

export async function fetchBalance(accountUid: string): Promise<number | undefined> {
  const res = await proxyFetch(`/accounts/${encodeURIComponent(accountUid)}/balances`);
  const data = asRecord(await res.json(), "balances-respons");
  const balances = asArray(data.balances ?? [], "balances") as Array<{
    balance_amount?: { amount?: string };
    balance_type?: string;
  }>;
  // Prefer closing/expected, fall back to first entry
  const preferred =
    balances.find((b) => ["CLBD", "XPCD", "CLAV"].includes(b.balance_type ?? "")) ?? balances[0];
  if (!preferred) return undefined;
  const n = parseFloat(preferred.balance_amount?.amount ?? "");
  return isNaN(n) ? undefined : n;
}

export async function fetchAllTransactions(
  accountUid: string,
  dateFrom: string | undefined,
  onProgress?: (count: number) => void,
  localUid?: string,
): Promise<Transaction[]> {
  const all: Transaction[] = [];
  let ck: string | undefined;

  do {
    const { transactions, continuationKey } = await fetchTransactions(
      accountUid,
      dateFrom,
      ck,
      localUid,
    );
    all.push(...transactions);
    ck = continuationKey;
    onProgress?.(all.length);
  } while (ck);

  return all;
}
