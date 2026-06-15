import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteAccount, resetAccountSync, setCategoryId } from "../lib/store";
import { accountLabel } from "../lib/format";
import { useAccounts } from "../hooks/useAccounts";
import { useTransactions } from "../hooks/useTransactions";
import { useSyncState } from "../hooks/useSyncState";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { useSnackbar } from "../components/ui/Snackbar";
import FlowSummaryChart from "../components/charts/FlowSummaryChart";
import TransactionTable from "../components/transactions/TransactionTable";
import { ArrowLeftIcon, RefreshCwIcon } from "../components/ui/icons";

function txMonth(date?: string): string {
  return date ? date.slice(0, 7) : "";
}

function monthLabel(ym: string): string {
  try {
    return new Date(ym + "-01").toLocaleDateString("nb-NO", { month: "short", year: "numeric" });
  } catch {
    return ym;
  }
}

export default function AccountPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { accounts, loading: accountsLoading, reload } = useAccounts();
  const { transactions: all, loading: txLoading, refresh } = useTransactions(uid);
  const { syncing, syncMsg, error: syncError, failedAccounts, run: runSync } = useSyncState();
  const accountError = failedAccounts.get(uid ?? "");
  const { showSnackbar } = useSnackbar();
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    if (syncMsg) showSnackbar(syncMsg, "ok");
  }, [syncMsg, showSnackbar]);

  const loading = accountsLoading || txLoading;

  const account = accounts.find((a) => a.uid === uid) ?? null;

  const sorted = useMemo(
    () =>
      [...all].sort((a, b) =>
        (b.bookingDate ?? b.transactionDate ?? "").localeCompare(
          a.bookingDate ?? a.transactionDate ?? "",
        ),
      ),
    [all],
  );

  const months = useMemo(
    () =>
      [
        ...new Set(sorted.map((t) => txMonth(t.bookingDate ?? t.transactionDate)).filter(Boolean)),
      ].sort((a, b) => b.localeCompare(a)),
    [sorted],
  );

  const filtered = useMemo(
    () =>
      selectedMonth
        ? sorted.filter((t) => txMonth(t.bookingDate ?? t.transactionDate) === selectedMonth)
        : sorted,
    [selectedMonth, sorted],
  );

  // Reset month filter when navigating to a different account (render-phase setState)
  const [prevUid, setPrevUid] = useState(uid);
  if (prevUid !== uid) {
    setPrevUid(uid);
    setSelectedMonth("");
  }

  const isConnected = account ? account.sources.some((s) => s.type === "enableBanking") : false;
  const currency = account?.currency ?? filtered[0]?.currency ?? "NOK";

  const removeAccount = useCallback(async () => {
    if (!uid || !confirm("Fjern denne kontoen og alle tilhørende transaksjoner?")) return;
    await deleteAccount(uid);
    navigate("/dashboard");
  }, [uid, navigate]);

  const resetSync = useCallback(async () => {
    if (
      !uid ||
      !confirm(
        "Slett lagrede transaksjoner for denne kontoen og nullstill synk-markøren? Neste synkronisering henter alt på nytt basert på historikkinnstillingen.",
      )
    )
      return;
    await resetAccountSync(uid);
  }, [uid]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-muted hover:text-text transition-colors">
          <ArrowLeftIcon size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text">
              {account ? accountLabel(account) : "Konto"}
            </h1>
            {isConnected && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20 leading-none">
                Tilkoblet
              </span>
            )}
          </div>
          {(account?.bban || account?.iban) && (
            <div className="mono text-xs text-muted">{account?.bban ?? account?.iban}</div>
          )}
        </div>
        {isConnected ? (
          <Button
            size="sm"
            loading={syncing}
            disabled={!account}
            onClick={() => account && runSync([account], reload)}
          >
            <RefreshCwIcon size={12} />
            Synkroniser
          </Button>
        ) : (
          <Button size="sm" onClick={() => navigate("/connect")}>
            Koble til bank
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={resetSync}>
          Slett transaksjoner
        </Button>
        <Button size="sm" variant="danger" onClick={removeAccount}>
          Fjern konto
        </Button>
      </div>

      {(syncError || accountError) && (
        <Alert type="error" message={accountError ?? syncError ?? ""} className="mb-4" />
      )}

      <div className="card px-4 py-3 mb-6 inline-block">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Transaksjoner</div>
        <div className="text-lg font-semibold text-text mono">{filtered.length}</div>
      </div>

      {months.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              className={`text-xs px-3 py-1.5 rounded transition-colors ${!selectedMonth ? "bg-accent/10 text-accent border border-accent/20" : "btn-ghost"}`}
              onClick={() => setSelectedMonth("")}
            >
              Alle
            </button>
            {months.map((m) => (
              <button
                key={m}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${selectedMonth === m ? "bg-accent/10 text-accent border border-accent/20" : "btn-ghost"}`}
                onClick={() => setSelectedMonth(m)}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedMonth && <FlowSummaryChart transactions={filtered} currency={currency} />}

      <TransactionTable
        transactions={filtered}
        onCategoryChange={async (txId, catId) => {
          await setCategoryId(txId, catId);
          refresh();
        }}
      />
    </div>
  );
}
