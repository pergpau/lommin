import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { CheckIcon } from "../components/ui/icons";
import Spinner from "../components/ui/Spinner";
import { useSnackbar } from "../components/ui/Snackbar";
import { SESSION_VALID_DAYS } from "../constants";
import { createSession, initiateAuth, listBanks, ProxyNetworkError, type BankEntry } from "../lib/enableBanking";
import { getAccounts, saveAccount, type Account, type AccountSource } from "../lib/store";
import { syncAccounts } from "../lib/sync";

const COUNTRY_CODES = ["NO", "SE", "FI", "DK", "GB", "DE", "FR", "NL"] as const;

const STATE_KEY = "lommin_auth_state";
const BANK_KEY = "lommin_auth_bank";
const BANK_COUNTRY_KEY = "lommin_auth_bank_country";

type Phase = "pick" | "connecting" | "callback" | "syncing" | "done" | "error";

function phaseFromUrl(): Phase {
  const sp = new URLSearchParams(window.location.search);
  if (sp.get("code")) return "callback";
  if (sp.get("reauth") || sp.get("uid")) return "connecting";
  return "pick";
}

export default function Connect() {
  const { t } = useTranslation("connect");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showSnackbar } = useSnackbar();
  const searchRef = useRef<HTMLInputElement>(null);

  const [country, setCountry] = useState("NO");
  const [banks, setBanks] = useState<BankEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BankEntry | null>(null);
  const [phase, setPhase] = useState<Phase>(phaseFromUrl);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [loadedCountry, setLoadedCountry] = useState<string | null>(null);
  const callbackStarted = useRef(false);
  const reauthStarted = useRef(false);
  const [previousBanks, setPreviousBanks] = useState<Array<{ name: string; country: string }>>([]);
  const quickConnectStarted = useRef(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return banks;
    const starts: BankEntry[] = [];
    const contains: BankEntry[] = [];
    for (const b of banks) {
      const n = b.name.toLowerCase();
      if (n.startsWith(q)) starts.push(b);
      else if (n.includes(q)) contains.push(b);
    }
    return [...starts, ...contains];
  }, [query, banks]);

  const initiateConnectFor = useCallback(async (aspsp: { name: string; country: string }) => {
    try {
      const state = crypto.randomUUID();
      localStorage.setItem(STATE_KEY, state);
      localStorage.setItem(BANK_KEY, aspsp.name);
      localStorage.setItem(BANK_COUNTRY_KEY, aspsp.country);
      const validUntil = new Date(Date.now() + SESSION_VALID_DAYS * 86400_000)
        .toISOString()
        .replace(/\.\d+Z$/, "Z");
      const redirectUrl = `${window.location.origin}/connect`;
      const url = await initiateAuth({ aspsp, redirectUrl, validUntil, state });
      window.location.href = url;
    } catch (e) {
      const detail = e instanceof ProxyNetworkError
        ? t("proxyUnreachable")
        : (e instanceof Error ? e.message : "");
      const msg = detail ? `${t("authFailed")}: ${detail}` : t("authFailed");
      setError(msg);
      setPhase("error");
      quickConnectStarted.current = false;
      showSnackbar(msg, "error");
    }
  }, [t, showSnackbar]);

  const connect = useCallback(async () => {
    if (!selected) return;
    setPhase("connecting");
    await initiateConnectFor(selected);
  }, [selected, initiateConnectFor]);

  useEffect(() => {
    if (params.get("code") || params.get("reauth") || params.get("uid")) return;
    getAccounts().then((accounts) => {
      const seen = new Set<string>();
      const unique: Array<{ name: string; country: string }> = [];
      for (const acc of accounts) {
        if (!acc.bankName || !acc.bankCountry) continue;
        const key = `${acc.bankCountry}::${acc.bankName}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push({ name: acc.bankName, country: acc.bankCountry });
        }
      }
      setPreviousBanks(unique);
    });
  }, [params]);

  const quickConnect = useCallback(
    (bank: { name: string; country: string }) => {
      if (quickConnectStarted.current) return;
      quickConnectStarted.current = true;
      setPhase("connecting");
      initiateConnectFor(bank);
    },
    [initiateConnectFor],
  );

  useEffect(() => {
    const code = params.get("code");
    const returnedState = params.get("state");
    if (!code) return;
    if (callbackStarted.current) return;
    callbackStarted.current = true;

    const storedState = localStorage.getItem(STATE_KEY);
    const csrfError =
      !storedState || !returnedState || returnedState !== storedState
        ? t("csrfError")
        : null;

    localStorage.removeItem(STATE_KEY);
    const bankName = !csrfError ? (localStorage.getItem(BANK_KEY) ?? undefined) : undefined;
    const bankCountry = !csrfError
      ? (localStorage.getItem(BANK_COUNTRY_KEY) ?? undefined)
      : undefined;
    localStorage.removeItem(BANK_KEY);
    localStorage.removeItem(BANK_COUNTRY_KEY);

    (csrfError ? Promise.reject(new Error(csrfError)) : createSession(code))
      .then(async ({ sessionId, accounts }) => {
        const existing = await getAccounts();
        const saved: Account[] = [];
        for (const acc of accounts) {
          const normBban = (s: string) => s.replace(/\D/g, "");
          const match = existing.find(
            (e) =>
              (acc.identificationHash &&
                e.identificationHash &&
                acc.identificationHash === e.identificationHash) ||
              (acc.iban && e.iban && acc.iban === e.iban) ||
              (acc.bban && e.bban && normBban(acc.bban) === normBban(e.bban)),
          );
          const ebSource: AccountSource = { type: "enableBanking", sourceId: acc.uid, sessionId };
          let record: Account;
          if (match) {
            const otherSources = match.sources.filter(
              (s) => !(s.type === "enableBanking" && s.sourceId === acc.uid),
            );
            record = {
              ...match,
              name: acc.name ?? match.name,
              bankName: bankName ?? match.bankName,
              bankCountry: bankCountry ?? match.bankCountry,
              currency: acc.currency ?? match.currency,
              iban: acc.iban ?? match.iban,
              bban: acc.bban ?? match.bban,
              identificationHash: acc.identificationHash ?? match.identificationHash,
              identificationHashes: acc.identificationHashes ?? match.identificationHashes,
              sources: [...otherSources, ebSource],
            };
          } else {
            record = {
              uid: crypto.randomUUID(),
              name: acc.name,
              bankName,
              bankCountry,
              currency: acc.currency,
              iban: acc.iban,
              bban: acc.bban,
              identificationHash: acc.identificationHash,
              identificationHashes: acc.identificationHashes,
              addedAt: Date.now(),
              sources: [ebSource],
            };
          }
          await saveAccount(record);
          saved.push(record);
        }
        setPhase("syncing");
        try {
          await syncAccounts(saved, setSyncMsg);
        } catch {
          /* dashboard sync button can retry */
        }
        setPhase("done");
        setTimeout(() => navigate("/dashboard"), 800);
      })
      .catch((e: Error) => {
        const detail = e instanceof ProxyNetworkError ? t("proxyUnreachable") : e.message;
        const msg = `${t("sessionFailed")}: ${detail}`;
        setError(msg);
        setPhase("error");
        showSnackbar(msg, "error");
      });
  }, [params, navigate, t, showSnackbar]);

  useEffect(() => {
    if (params.get("code")) return;
    const reauth = params.get("reauth");
    const reauthCountry = params.get("country");
    const uid = params.get("uid");

    if (reauth && reauthCountry) {
      if (!reauthStarted.current) {
        reauthStarted.current = true;
        Promise.resolve({ name: reauth, country: reauthCountry }).then(initiateConnectFor);
      }
      return;
    }

    if (uid) {
      if (!reauthStarted.current) {
        reauthStarted.current = true;
        getAccounts().then((accounts) => {
          const acc = accounts.find((a) => a.uid === uid);
          if (acc?.bankName && acc?.bankCountry) {
            initiateConnectFor({ name: acc.bankName, country: acc.bankCountry });
          } else {
            navigate("/connect");
          }
        });
      }
    }
  }, [params, initiateConnectFor, navigate]);

  useEffect(() => {
    if (params.get("code") || params.get("reauth") || params.get("uid")) return;
    listBanks(country)
      .then((list) => {
        setBanks(list);
        setLoadedCountry(country);
        setPhase("pick");
      })
      .catch((e) => {
        const detail = e instanceof ProxyNetworkError ? t("proxyUnreachable") : (e instanceof Error ? e.message : "");
        const msg = detail ? `${t("loadBanksFailed")}: ${detail}` : t("loadBanksFailed");
        setError(msg);
        setPhase("error");
        showSnackbar(msg, "error");
      });
  }, [country, params, showSnackbar, t]);

  const isReauth = (!!params.get("reauth") || !!params.get("uid")) && !params.get("code");
  const isOAuthFlow = !!(params.get("code") || params.get("reauth") || params.get("uid"));
  const banksLoading = !isOAuthFlow && phase !== "error" && loadedCountry !== country;

  if ((isReauth || phase === "connecting") && phase !== "error") {
    return (
      <div className="flex-1 bg-bg grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center animate-fade-in">
          <Spinner size={32} />
          <div className="text-muted text-sm mt-4">{t("statuses.connecting")}</div>
        </div>
      </div>
    );
  }

  if (phase === "callback" || phase === "syncing" || phase === "done") {
    return (
      <div className="flex-1 bg-bg grid-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          {phase === "done" ? (
            <>
              <div className="w-12 h-12 rounded-full bg-positive/10 border border-positive/20 flex items-center justify-center mx-auto mb-4">
                <CheckIcon size={22} className="text-positive" />
              </div>
              <div className="text-text font-medium">{t("statuses.connected")}</div>
              <div className="text-muted text-sm mt-1">{t("statuses.loadingOverview")}</div>
            </>
          ) : (
            <>
              <Spinner size={32} />
              <div className="text-muted text-sm mt-4">
                {phase === "syncing"
                  ? syncMsg || t("statuses.fetchingTransactions")
                  : t("statuses.creatingSession")}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text tracking-tight">{t("title")}</h1>
        <p className="text-muted text-sm mt-1">{t("subtitle")}</p>
      </div>

      {phase === "error" && <Alert type="error" message={error} className="mb-4" />}

      {previousBanks.length > 0 && (
        <Card className="p-4 mb-4">
          <label className="label">{t("previousBanks.label")}</label>
          <div className="flex flex-col gap-1.5 mt-1">
            {previousBanks.map((bank) => (
              <button
                key={`${bank.country}::${bank.name}`}
                onClick={() => quickConnect(bank)}
                className="w-full text-left px-3 py-2 rounded text-sm text-text hover:bg-surface-2 border border-border/40 transition-colors flex items-center justify-between group"
              >
                <span>{bank.name}</span>
                <span className="text-muted text-xs group-hover:text-accent transition-colors">
                  {t("previousBanks.connect")}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <label className="label">{t("countryLabel")}</label>
        <select
          className="input bg-surface-2"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setSelected(null);
            setQuery("");
          }}
          disabled={banksLoading}
        >
          {COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>
              {t("countries." + code)}
            </option>
          ))}
        </select>
      </Card>

      <Card className="p-4 mb-4">
        <label className="label">{t("bankLabel")}</label>
        <div className="min-h-72">
          {banksLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted text-sm py-2">
              <Spinner size={14} />
              <span>{t("loadingBanks")}</span>
            </div>
          ) : (
            <>
              <input
                ref={searchRef}
                className="input mb-3"
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="max-h-56 overflow-y-auto -mx-1 space-y-0.5">
                {filtered.length === 0 && (
                  <div className="text-muted text-sm px-2 py-4 text-center">
                    {t("noBanksFound")}
                  </div>
                )}
                {filtered.map((bank) => (
                  <button
                    key={bank.name}
                    onClick={() => setSelected(bank)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selected?.name === bank.name
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-text hover:bg-surface-2"
                    }`}
                  >
                    {bank.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      <Button
        className="w-full py-2.5 justify-center"
        disabled={!selected}
        onClick={connect}
      >
        {selected ? t("connectButton", { name: `"${selected.name}"` }) : t("connectButtonGeneric")}
      </Button>
    </div>
  );
}
