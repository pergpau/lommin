import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { triggerAutosave } from "../lib/autosave";
import { type Transaction } from "../lib/store";
import { deleteAccount, deleteTransaction, disconnectAccount, resetAccountSync, setCategoryId, setComment, setCustomDate, setIsExtraordinary } from "../lib/mutations";
import { getSetting } from "../lib/settings";
import { accountLabel, effectiveDate } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { SUB_CATEGORY_MAP } from "../lib/categories";
import { useAccounts } from "../hooks/useAccounts";
import { useTransactions } from "../hooks/useTransactions";
import { useSyncState } from "../hooks/useSyncState";
import { useSuccessFlash } from "../hooks/useSuccessFlash";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import { useSnackbar } from "../components/ui/Snackbar";
import MonthlyChart, { type ChartMode, type MonthBar } from "../components/charts/MonthlyChart";
import TransactionTable from "../components/transactions/TransactionTable";
import ResyncModal from "../components/ResyncModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { ArrowLeftIcon, RefreshCwIcon, XIcon } from "../components/ui/icons";
import { isDemoMode } from "../lib/demoData";
import { loadKey } from "../lib/keystore";

function txSection(tx: Transaction): "income" | "expense" | "saving" | null {
  if (tx.isExtraordinary) return null;
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
  const [isDemo, setIsDemo] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const { success: syncSuccess, flash: syncFlash } = useSuccessFlash();

  useEffect(() => {
    void isDemoMode().then(setIsDemo);
    void loadKey().then((kv) => setHasKey(!!kv));
  }, []);

  useEffect(() => {
    if (syncMsg) showSnackbar(syncMsg, "ok");
  }, [syncMsg, showSnackbar]);

  useEffect(() => {
    if (syncError) showSnackbar(syncError, "error");
  }, [syncError, showSnackbar]);

  useEffect(() => {
    if (accountError) showSnackbar(accountError, "error");
  }, [accountError, showSnackbar]);

  const loading = accountsLoading || txLoading;

  const account = accounts.find((a) => a.uid === uid) ?? null;

  const sorted = useMemo(
    () =>
      [...all].sort((a, b) =>
        (effectiveDate(b) ?? "").localeCompare(effectiveDate(a) ?? ""),
      ),
    [all],
  );

  const monthlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const tx of sorted) {
      const section = txSection(tx);
      if (!section) continue;
      const date = effectiveDate(tx);
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
      const date = effectiveDate(tx);
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
            const date = effectiveDate(tx) ?? "";
            return chartMode === "year"
              ? date.slice(0, 4) === selectedMonth
              : date.slice(0, 7) === selectedMonth;
          })
        : sorted,
    [selectedMonth, sorted, chartMode],
  );

  const [actionsOpen, setActionsOpen] = useState(false);
  const [resyncModal, setResyncModal] = useState(false);
  const [resyncDays, setResyncDays] = useState(90);

  const [prevUid, setPrevUid] = useState(uid);
  if (prevUid !== uid) {
    setPrevUid(uid);
    setSelectedMonth("");
    setChartMode("month");
  }

  const isConnected = account ? account.sources.some((s) => s.type === "enableBanking") : false;

  const openResyncModal = useCallback(async () => {
    const days = await getSetting("lookbackDays");
    setResyncDays(days);
    setResyncModal(true);
  }, []);

  const runForcedResync = useCallback(() => {
    if (!account) return;
    setResyncModal(false);
    const d = new Date();
    d.setDate(d.getDate() - resyncDays);
    const dateFrom = d.toISOString().split("T")[0];
    void runSync([account], (hadErrors) => { reload(); refresh(); if (!hadErrors) void triggerAutosave(); }, dateFrom);
  }, [account, resyncDays, runSync, reload]);

  const disconnectBank = useCallback(async () => {
    if (!uid || !confirm(t("confirm.disconnectAccount"))) return;
    await disconnectAccount(uid);
    reload();
  }, [uid, t, reload]);

  const removeAccount = useCallback(async () => {
    if (!uid || !confirm(t("confirm.removeAccount"))) return;
    await deleteAccount(uid);
    navigate("/dashboard");
  }, [uid, navigate, t]);

  const resetSync = useCallback(async () => {
    if (!uid || !confirm(t("confirm.deleteTransactions"))) return;
    await resetAccountSync(uid);
    refresh();
  }, [uid, t, refresh]);

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
          <h1 className="text-xl font-semibold text-text">
            {account ? accountLabel(account) : t("fallbackTitle")}
          </h1>
          {(account?.bban || account?.iban) && (
            <div className="mono text-xs text-muted">{account?.bban ?? account?.iban}</div>
          )}
          {isConnected && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20 leading-none">
              {t("connectedBadge")}
            </span>
          )}
        </div>
        {/* Sync / Connect button — always visible */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button
              size="sm"
              loading={syncing}
              success={syncSuccess}
              disabled={!account}
              onClick={() => account && runSync([account], (hadErrors) => { reload(); refresh(); if (!hadErrors) { void triggerAutosave(); syncFlash(); } })}
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

          {/* Settings cogwheel — Delete transactions + Remove account */}
          <div className="relative">
            <button
              className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors flex items-center justify-center"
              onClick={() => setActionsOpen((o) => !o)}
              aria-label="Account settings"
            >
              {actionsOpen ? <XIcon size={18} /> : <FontAwesomeIcon icon={faGear} className="w-[18px] h-[18px]" />}
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 card py-1 z-30 shadow-lg">
                {isConnected && (
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                    onClick={() => { setActionsOpen(false); void openResyncModal(); }}
                  >
                    {t("forcedResync")}
                  </button>
                )}
                {isConnected && (
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                    onClick={() => { setActionsOpen(false); void disconnectBank(); }}
                  >
                    {t("disconnectAccount")}
                  </button>
                )}
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                  onClick={() => { setActionsOpen(false); void resetSync(); }}
                >
                  {t("deleteTransactions")}
                </button>
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-danger hover:bg-surface-2 transition-colors text-left"
                  onClick={() => { setActionsOpen(false); void removeAccount(); }}
                >
                  {t("removeAccount")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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

      <TransactionTable
        transactions={filtered}
        subtitle={
          selectedMonth
            ? chartMode === "year"
              ? selectedMonth
              : new Date(selectedMonth + "-15").toLocaleDateString(getLocale(), { month: "long", year: "numeric" })
            : undefined
        }
        onCategoryChange={async (txId, catId) => { await setCategoryId(txId, catId); refresh(); }}
        onIsExtraordinaryChange={async (txId, value) => { await setIsExtraordinary(txId, value); refresh(); }}
        onCustomDateChange={async (txId, date) => { await setCustomDate(txId, date); refresh(); }}
        onCommentChange={async (txId, comment) => { await setComment(txId, comment); refresh(); }}
        onDelete={async (txId) => { await deleteTransaction(txId); refresh(); }}
      />

      {resyncModal && (
        <ResyncModal
          days={resyncDays}
          onDaysChange={setResyncDays}
          onConfirm={runForcedResync}
          onCancel={() => setResyncModal(false)}
        />
      )}
    </div>
  );
}
