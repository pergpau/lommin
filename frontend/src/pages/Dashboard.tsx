import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccounts } from "../hooks/useAccounts";
import { useTransactions } from "../hooks/useTransactions";
import { useSyncState } from "../hooks/useSyncState";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import AccountCard from "../components/AccountCard";
import MonthlyChart, { type MonthBar, type ChartMode } from "../components/charts/MonthlyChart";
import TransactionTable from "../components/transactions/TransactionTable";
import SpendingBreakdown from "../components/charts/SpendingBreakdown";
import { DownloadIcon, MenuIcon, RefreshCwIcon, XIcon } from "../components/ui/icons";
import { saveEncryptedFile } from "../lib/cryptoFile";
import { exportAll, setCategoryId } from "../lib/store";
import { SUB_CATEGORY_MAP } from "../lib/categories";

export default function Dashboard() {
  const { accounts, loading: accountsLoading, reload } = useAccounts();
  const { transactions, loading: txLoading, refresh } = useTransactions();
  const {
    syncing,
    syncMsg,
    error,
    failedAccounts,
    syncingAccountUids,
    run: runSync,
  } = useSyncState();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("month");
  const loading = accountsLoading || txLoading;
  const [tab, setTab] = useState<"kategorier" | "kontoer" | "transaksjoner">("kategorier");
  const tabInitialized = useRef(false);
  useEffect(() => {
    if (!loading && !tabInitialized.current) {
      tabInitialized.current = true;
      if (accounts.length === 0) setTab("kontoer");
    }
  }, [loading, accounts.length]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savePassphrase, setSavePassphrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const passphraseRef = useRef<HTMLInputElement>(null);

  const handleSaveFile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const data = await exportAll();
      await saveEncryptedFile(data, savePassphrase);
      setSaveMsg({ type: "ok", text: "Fil lagret." });
      setSavePassphrase("");
      setTimeout(() => {
        setSaveOpen(false);
        setSaveMsg(null);
      }, 1500);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setSaveMsg({ type: "err", text: e instanceof Error ? e.message : "Lagring feilet" });
    } finally {
      setSaving(false);
    }
  };

  function txSection(t: (typeof transactions)[0]): "income" | "expense" | "saving" | null {
    if (t.isTransfer) return null;
    if (t.categoryId != null) {
      const type = SUB_CATEGORY_MAP[t.categoryId]?.type;
      if (type === "exclude") return null;
      if (type === "income") return "income";
      if (type === "saving") return "saving";
      return "expense";
    }
    return t.amount > 0 ? "income" : "expense";
  }

  const monthlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const t of transactions) {
      const section = txSection(t);
      if (!section) continue;
      const date = t.bookingDate ?? t.transactionDate;
      if (!date) continue;
      const key = date.slice(0, 7);
      const entry = map.get(key) ?? { income: 0, expenses: 0, saving: 0 };
      if (section === "income") entry.income += t.amount;
      else if (section === "saving") entry.saving += -t.amount;
      else entry.expenses += -t.amount;
      map.set(key, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { income, expenses, saving }]) => {
        const d = new Date(key + "-15");
        const raw = d.toLocaleDateString("nb-NO", { month: "long" });
        return { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), income, expenses, saving };
      });
  }, [transactions]);

  const yearlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const t of transactions) {
      const section = txSection(t);
      if (!section) continue;
      const date = t.bookingDate ?? t.transactionDate;
      if (!date) continue;
      const key = date.slice(0, 4);
      const entry = map.get(key) ?? { income: 0, expenses: 0, saving: 0 };
      if (section === "income") entry.income += t.amount;
      else if (section === "saving") entry.saving += -t.amount;
      else entry.expenses += -t.amount;
      map.set(key, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { income, expenses, saving }]) => ({
        key,
        label: key,
        income,
        expenses,
        saving,
      }));
  }, [transactions]);

  const chartData = chartMode === "month" ? monthlyData : yearlyData;
  const activeMonth =
    chartData.find((m) => m.key === selectedMonth)?.key ??
    chartData[chartData.length - 1]?.key ??
    null;

  const txByAccount = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const list = map.get(t.accountUid) ?? [];
      list.push(t);
      map.set(t.accountUid, list);
    }
    return map;
  }, [transactions]);

  const recent = useMemo(
    () =>
      [...transactions]
        .filter((t) => {
          if (!activeMonth) return true;
          const date = t.bookingDate ?? t.transactionDate;
          return date ? date.startsWith(activeMonth) : false;
        })
        .sort((a, b) =>
          (b.bookingDate ?? b.transactionDate ?? "").localeCompare(
            a.bookingDate ?? a.transactionDate ?? "",
          ),
        ),
    [transactions, activeMonth],
  );

  const selectedMonthBar = chartData.find((m) => m.key === activeMonth);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-text">Oversikt</h1>
          <p className="text-muted text-sm mt-0.5">
            {accounts.length} konto{accounts.length !== 1 ? "er" : ""} · {transactions.length}{" "}
            transaksjoner
          </p>
        </div>
        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-2">
          <Link to="/connect" className="btn-ghost text-xs">
            + Legg til konto
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              setSaveOpen(true);
              setSaveMsg(null);
              setTimeout(() => passphraseRef.current?.focus(), 50);
            }}
          >
            <DownloadIcon size={14} />
            Lagre som fil
          </Button>
          <Button
            loading={syncing}
            disabled={accounts.length === 0}
            onClick={() => runSync(accounts, reload)}
          >
            <RefreshCwIcon size={14} />
            Synkroniser
          </Button>
        </div>

        {/* Mobile hamburger */}
        <div className="sm:hidden relative">
          <button
            className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
            onClick={() => setActionsOpen((o) => !o)}
            aria-label="Handlinger"
          >
            {actionsOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
          {actionsOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 card py-1 z-30 shadow-lg">
              <Link
                to="/connect"
                className="flex items-center px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors"
                onClick={() => setActionsOpen(false)}
              >
                + Legg til konto
              </Link>
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                onClick={() => {
                  setActionsOpen(false);
                  setSaveOpen(true);
                  setSaveMsg(null);
                  setTimeout(() => passphraseRef.current?.focus(), 50);
                }}
              >
                <DownloadIcon size={13} />
                Lagre som fil
              </button>
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-40 transition-colors text-left"
                disabled={accounts.length === 0 || syncing}
                onClick={() => {
                  setActionsOpen(false);
                  runSync(accounts, reload);
                }}
              >
                <RefreshCwIcon size={13} />
                {syncing ? "Synkroniserer…" : "Synkroniser"}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} className="mb-6">
          {error.includes("401") && (
            <>
              {" "}
              ·{" "}
              <Link to="/connect" className="underline underline-offset-2">
                Koble til på nytt
              </Link>
            </>
          )}
        </Alert>
      )}

      {syncMsg && !syncing && <Alert type="ok" message={syncMsg} className="mb-6" />}

      {chartData.length > 0 && (
        <div className="mb-8">
          <MonthlyChart
            bars={chartData}
            activeKey={activeMonth}
            onSelect={setSelectedMonth}
            mode={chartMode}
            onModeChange={(m) => {
              setChartMode(m);
              setSelectedMonth(null);
            }}
          />
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-border">
        {(["kategorier", "kontoer", "transaksjoner"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "kategorier" ? "Kategorier" : t === "kontoer" ? "Kontoer" : "Alle transaksjoner"}
          </button>
        ))}
      </div>

      {tab === "kategorier" && (
        <SpendingBreakdown
          transactions={recent}
          onCategoryChange={async (txId, catId) => {
            await setCategoryId(txId, catId);
            refresh();
          }}
        />
      )}

      {tab === "kontoer" &&
        (accounts.length === 0 ? (
          <EmptyState message="Ingen kontoer tilkoblet ennå." className="mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
              <Link to="/connect" className="btn-primary inline-flex">
                Koble til en bank
              </Link>
              <span className="text-muted text-sm">eller</span>
              <Link to="/settings#spiir" className="btn-secondary inline-flex">
                Importer data fra Spiir
              </Link>
            </div>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const txns = txByAccount.get(acc.uid) ?? [];
              const balance = acc.balance ?? txns.reduce((s, t) => s + t.amount, 0);
              return (
                <AccountCard
                  key={acc.uid}
                  acc={acc}
                  txns={txns}
                  balance={balance}
                  isSyncing={syncingAccountUids.has(acc.uid)}
                  errorMsg={failedAccounts.get(acc.uid)}
                />
              );
            })}
          </div>
        ))}

      {tab === "transaksjoner" &&
        (recent.length > 0 ? (
          <TransactionTable
            transactions={recent}
            title={
              selectedMonthBar ? `Transaksjoner — ${selectedMonthBar.label}` : "Siste transaksjoner"
            }
            onCategoryChange={async (txId, catId) => {
              await setCategoryId(txId, catId);
              refresh();
            }}
          />
        ) : (
          <div className="card p-10 text-center text-muted text-sm">
            Ingen transaksjoner denne måneden.
          </div>
        ))}

      {saveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSaveOpen(false)}
        >
          <div className="card p-5 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text mb-1">Lagre sikkerhetskopi</h2>
            <p className="text-xs text-muted mb-4">
              Valgfritt: beskytt filen med et passord. La feltet stå tomt for å lagre uten
              kryptering.
            </p>
            {saveMsg && (
              <Alert
                type={saveMsg.type === "ok" ? "ok" : "error"}
                message={saveMsg.text}
                className="mb-3"
              />
            )}
            <input
              ref={passphraseRef}
              type="password"
              placeholder="La stå tomt for ingen kryptering"
              value={savePassphrase}
              onChange={(e) => setSavePassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveFile()}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-muted focus:outline-none focus:border-accent mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Avbryt
              </Button>
              <Button loading={saving} onClick={handleSaveFile}>
                {!saving && <DownloadIcon size={13} />}
                Lagre
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
