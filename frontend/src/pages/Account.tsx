import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { triggerAutosave } from "../lib/autosave";
import { deleteAccount, resetAccountSync, setCategoryId, type Transaction } from "../lib/store";
import { accountLabel } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { SUB_CATEGORY_MAP } from "../lib/categories";
import { useAccounts } from "../hooks/useAccounts";
import { useTransactions } from "../hooks/useTransactions";
import { useSyncState } from "../hooks/useSyncState";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { useSnackbar } from "../components/ui/Snackbar";
import MonthlyChart, { type ChartMode, type MonthBar } from "../components/charts/MonthlyChart";
import TransactionTable from "../components/transactions/TransactionTable";
import { ArrowLeftIcon, RefreshCwIcon } from "../components/ui/icons";
import { isDemoMode } from "../lib/demoData";
import { loadKey } from "../lib/keystore";

function txSection(tx: Transaction): "income" | "expense" | "saving" | null {
  if (tx.categoryId != null) {
    const type = SUB_CATEGORY_MAP[tx.categoryId]?.type;
    if (type === "exclude") return null;
    if (type === "income") return "income";
    if (type === "saving") return "saving";
    return "expense";
  }
  return tx.amount > 0 ? "income" : "expense";
}

export default function AccountPage() {
  const { t } = useTranslation("account");
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { accounts, loading: accountsLoading, reload } = useAccounts();
  const { transactions: all, loading: txLoading, refresh } = useTransactions(uid);
  const { syncing, syncMsg, error: syncError, failedAccounts, run: runSync } = useSyncState();
  const accountError = failedAccounts.get(uid ?? "");
  const { showSnackbar } = useSnackbar();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("month");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    void isDemoMode().then(setIsDemo);
    void loadKey().then((kv) => setHasKey(!!kv));
  }, []);

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

  const monthlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const tx of sorted) {
      const section = txSection(tx);
      if (!section) continue;
      const date = tx.bookingDate ?? tx.transactionDate;
      if (!date) continue;
      const key = date.slice(0, 7);
      const entry = map.get(key) ?? { income: 0, expenses: 0, saving: 0 };
      if (section === "income") entry.income += tx.amount;
      else if (section === "saving") entry.saving += -tx.amount;
      else entry.expenses += -tx.amount;
      map.set(key, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { income, expenses, saving }]) => {
        const d = new Date(key + "-15");
        const raw = d.toLocaleDateString(getLocale(), { month: "long" });
        return { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), income, expenses, saving };
      });
  }, [sorted]);

  const yearlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const tx of sorted) {
      const section = txSection(tx);
      if (!section) continue;
      const date = tx.bookingDate ?? tx.transactionDate;
      if (!date) continue;
      const key = date.slice(0, 4);
      const entry = map.get(key) ?? { income: 0, expenses: 0, saving: 0 };
      if (section === "income") entry.income += tx.amount;
      else if (section === "saving") entry.saving += -tx.amount;
      else entry.expenses += -tx.amount;
      map.set(key, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { income, expenses, saving }]) => ({ key, label: key, income, expenses, saving }));
  }, [sorted]);

  const chartData = chartMode === "month" ? monthlyData : yearlyData;

  const filtered = useMemo(
    () =>
      selectedMonth
        ? sorted.filter((tx) => {
            const date = tx.bookingDate ?? tx.transactionDate ?? "";
            return chartMode === "year"
              ? date.slice(0, 4) === selectedMonth
              : date.slice(0, 7) === selectedMonth;
          })
        : sorted,
    [selectedMonth, sorted, chartMode],
  );

  const [prevUid, setPrevUid] = useState(uid);
  if (prevUid !== uid) {
    setPrevUid(uid);
    setSelectedMonth("");
    setChartMode("month");
  }

  const isConnected = account ? account.sources.some((s) => s.type === "enableBanking") : false;

  const removeAccount = useCallback(async () => {
    if (!uid || !confirm(t("confirm.removeAccount"))) return;
    await deleteAccount(uid);
    void triggerAutosave();
    navigate("/dashboard");
  }, [uid, navigate, t]);

  const resetSync = useCallback(async () => {
    if (!uid || !confirm(t("confirm.deleteTransactions"))) return;
    await resetAccountSync(uid);
    void triggerAutosave();
  }, [uid, t]);

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
              {account ? accountLabel(account) : t("fallbackTitle")}
            </h1>
            {isConnected && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20 leading-none">
                {t("connectedBadge")}
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
            onClick={() => account && runSync([account], () => { reload(); void triggerAutosave(); })}
          >
            <RefreshCwIcon size={12} />
            {t("sync")}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={isDemo}
            onClick={() => navigate(hasKey ? "/connect" : "/settings#pem")}
          >
            {t("connectBank")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={resetSync}>
          {t("deleteTransactions")}
        </Button>
        <Button size="sm" variant="danger" onClick={removeAccount}>
          {t("removeAccount")}
        </Button>
      </div>

      {(syncError || accountError) && (
        <Alert type="error" message={accountError ?? syncError ?? ""} className="mb-4" />
      )}

      {chartData.length > 0 && (
        <div className="mb-4">
          <MonthlyChart
            bars={chartData}
            activeKey={selectedMonth || null}
            onSelect={(key) => setSelectedMonth((prev) => (prev === key ? "" : key))}
            mode={chartMode}
            onModeChange={(m) => { setChartMode(m); setSelectedMonth(""); }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted uppercase tracking-wider">{t("transactionsLabel")}</span>
        <span className="text-sm font-semibold text-text mono">{filtered.length}</span>
      </div>

      <TransactionTable
        transactions={filtered}
        onCategoryChange={async (txId, catId) => {
          await setCategoryId(txId, catId);
          refresh();
          if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
          autosaveTimer.current = setTimeout(() => void triggerAutosave(), 3000);
        }}
      />
    </div>
  );
}
