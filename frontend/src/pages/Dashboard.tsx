import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AccountCard from "../components/AccountCard";
import MonthlyChart, { type ChartMode, type MonthBar } from "../components/charts/MonthlyChart";
import SpendingBreakdown from "../components/charts/SpendingBreakdown";
import TransactionTable from "../components/transactions/TransactionTable";
import Button from "../components/ui/Button";
import { useSnackbar } from "../components/ui/Snackbar";
import EmptyState from "../components/ui/EmptyState";
import { GoogleDriveIcon, HardDriveIcon, MenuIcon, PlusIcon, RefreshCwIcon, XIcon } from "../components/ui/icons";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";
import { useAccounts } from "../hooks/useAccounts";
import { useSyncState } from "../hooks/useSyncState";
import { useTransactions } from "../hooks/useTransactions";
import { SUB_CATEGORY_MAP } from "../lib/categories";
import { saveEncryptedFile } from "../lib/cryptoFile";
import { isDemoMode } from "../lib/demoData";
import { DriveAuthError, saveBackupToDrive } from "../lib/googleDrive";
import { loadKey } from "../lib/keystore";
import { effectiveDate } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { clearDriveToken, getAllSettings, getDriveToken } from "../lib/settings";
import { triggerAutosave } from "../lib/autosave";
import { clearAccounts, clearTransactions, exportAll, getEnableBankingSource, setCategoryId, setCustomDate, setIsExtraordinary } from "../lib/store";

type Tab = "categories" | "accounts" | "transactions";

export default function Dashboard() {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
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
  const { showSnackbar } = useSnackbar();
  const [hasKey, setHasKey] = useState(true);
  const [backupMethod, setBackupMethod] = useState<"drive" | "file">("file");
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [dashDriveToken, setDashDriveToken] = useState<string | null>(null);
  const [dashBackupSaving, setDashBackupSaving] = useState(false);
  const [dashDialog, setDashDialog] = useState(false);
  const [dashPassphrase, setDashPassphrase] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [exitingDemo, setExitingDemo] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doAutosave = useCallback(async () => {
    setAutoSaving(true);
    try {
      await triggerAutosave();
    } finally {
      setAutoSaving(false);
    }
  }, []);

  useEffect(() => {
    loadKey().then((kv) => setHasKey(!!kv));
    getAllSettings().then((s) => {
      setBackupMethod(s.backupMethod);
      setUsePassphrase(s.usePassphrase);
    });
    getDriveToken().then((stored) => {
      if (stored) setDashDriveToken(stored.token);
    });
    isDemoMode().then(setIsDemo);
  }, []);

  useEffect(() => {
    if (syncMsg) showSnackbar(syncMsg, "ok");
  }, [syncMsg, showSnackbar]);

  useEffect(() => {
    if (error) showSnackbar(error, "error");
  }, [error, showSnackbar]);

  useEffect(() => {
    if (failedAccounts.size > 0) {
      const firstMsg = [...failedAccounts.values()][0];
      showSnackbar(firstMsg, "error");
    }
  }, [failedAccounts, showSnackbar]);

  const handleQuickSaveClick = useCallback(() => {
    if (usePassphrase) {
      setDashPassphrase("");
      setDashDialog(true);
    } else {
      void handleQuickSave("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePassphrase, backupMethod, dashDriveToken]);

  const handleQuickSave = useCallback(async (passphrase: string) => {
    setDashDialog(false);
    setDashBackupSaving(true);
    try {
      const data = await exportAll();
      if (backupMethod === "drive") {
        if (!dashDriveToken) {
          navigate("/settings#backup");
          return;
        }
        await saveBackupToDrive(dashDriveToken, data, passphrase);
        showSnackbar(t("snackbar.savedToDrive"), "ok");
      } else {
        await saveEncryptedFile(data, passphrase);
        showSnackbar(t("snackbar.savedToFile"), "ok");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        if (e instanceof DriveAuthError) { setDashDriveToken(null); void clearDriveToken(); }
        showSnackbar(e instanceof Error ? e.message : t("snackbar.saveFailed"), "error");
      }
    } finally {
      setDashBackupSaving(false);
      setDashPassphrase("");
    }
  }, [backupMethod, dashDriveToken, showSnackbar, t]);

  const exitDemo = useCallback(async () => {
    setExitingDemo(true);
    await clearTransactions();
    await clearAccounts();
    navigate("/onboarding");
  }, [navigate]);

  const connectTarget = hasKey ? "/connect" : "/settings#pem";
  const BackupIcon = backupMethod === "drive" ? GoogleDriveIcon : HardDriveIcon;
  const hasLiveAccounts = accounts.some((acc) => !!getEnableBankingSource(acc));
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("month");
  const loading = accountsLoading || txLoading;
  const [tab, setTab] = useState<Tab>("categories");
  const tabInitialized = useRef(false);
  useEffect(() => {
    if (!loading && !tabInitialized.current) {
      tabInitialized.current = true;
      if (accounts.length === 0) setTab("accounts");
    }
  }, [loading, accounts.length]);
  const [actionsOpen, setActionsOpen] = useState(false);

  function txSection(tx: (typeof transactions)[0]): "income" | "expense" | "saving" | null {
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

  const monthlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const tx of transactions) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const yearlyData = useMemo<MonthBar[]>(() => {
    const map = new Map<string, { income: number; expenses: number; saving: number }>();
    for (const tx of transactions) {
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
      .map(([key, { income, expenses, saving }]) => ({
        key,
        label: key,
        income,
        expenses,
        saving,
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const chartData = chartMode === "month" ? monthlyData : yearlyData;
  const activeMonth =
    chartData.find((m) => m.key === selectedMonth)?.key ??
    chartData[chartData.length - 1]?.key ??
    null;

  const txByAccount = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const list = map.get(tx.accountUid) ?? [];
      list.push(tx);
      map.set(tx.accountUid, list);
    }
    return map;
  }, [transactions]);

  const recent = useMemo(
    () =>
      [...transactions]
        .filter((tx) => {
          if (!activeMonth) return true;
          const date = effectiveDate(tx);
          return date ? date.startsWith(activeMonth) : false;
        })
        .sort((a, b) =>
          (effectiveDate(b) ?? "").localeCompare(effectiveDate(a) ?? ""),
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

  const TABS: Tab[] = ["categories", "transactions", "accounts"];

  return (
    <>
      {isDemo && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-warning font-medium">{t("demo.banner")}</span>
          <Button variant="ghost" size="sm" loading={exitingDemo} onClick={exitDemo}>
            {t("demo.exit")}
          </Button>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-text">{t("title")}</h1>
            <p className="text-muted text-sm mt-0.5">
              {t("subtitle", { count: accounts.length, txCount: transactions.length })}
            </p>
          </div>
          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-2">
            {!isDemo && (
              <Link to={connectTarget} className="btn-ghost text-xs">
                {t("actions.addAccount")}
              </Link>
            )}
            <Button loading={dashBackupSaving || autoSaving} disabled={isDemo} onClick={handleQuickSaveClick}>
              <BackupIcon size={14} />
              {t("actions.save")}
            </Button>
            {hasLiveAccounts && (
              <Button
                loading={syncing}
                onClick={() => runSync(accounts, () => { reload(); refresh(); void doAutosave(); })}
              >
                <RefreshCwIcon size={14} />
                {t("actions.sync")}
              </Button>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="sm:hidden relative">
            <button
              className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
              onClick={() => setActionsOpen((o) => !o)}
              aria-label={t("actions.mobile")}
            >
              {actionsOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 card py-1 z-30 shadow-lg">
                {!isDemo && (
                  <Link
                    to={connectTarget}
                    className="flex items-center px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors"
                    onClick={() => setActionsOpen(false)}
                  >
                    {t("actions.addAccount")}
                  </Link>
                )}
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-40 transition-colors text-left"
                  disabled={isDemo || dashBackupSaving || autoSaving}
                  onClick={() => {
                    setActionsOpen(false);
                    handleQuickSaveClick();
                  }}
                >
                  <BackupIcon size={13} />
                  {dashBackupSaving ? t("actions.saving") : t("actions.save")}
                </button>
                {hasLiveAccounts && (
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-40 transition-colors text-left"
                    disabled={syncing}
                    onClick={() => {
                      setActionsOpen(false);
                      runSync(accounts, () => { reload(); refresh(); void doAutosave(); });
                    }}
                  >
                    <RefreshCwIcon size={13} />
                    {syncing ? t("actions.syncing") : t("actions.sync")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

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
          {TABS.map((tabKey) => (
            <button
              key={tabKey}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === tabKey
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
                }`}
              onClick={() => setTab(tabKey)}
            >
              {t("tabs." + tabKey)}
            </button>
          ))}
        </div>

        {tab === "categories" && (
          <SpendingBreakdown
            transactions={recent}
            onCategoryChange={async (txId, catId) => {
              await setCategoryId(txId, catId);
              refresh();
              if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
              autosaveTimer.current = setTimeout(() => void doAutosave(), 3000);
            }}
            onIsExtraordinaryChange={async (txId, value) => {
              await setIsExtraordinary(txId, value);
              refresh();
              if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
              autosaveTimer.current = setTimeout(() => void doAutosave(), 3000);
            }}
          />
        )}

        {tab === "accounts" &&
          (accounts.length === 0 ? (
            <EmptyState message={t("emptyAccounts")}>
              {!isDemo && (
                <div className="flex flex-col sm:flex-row items-center gap-2 justify-center mt-8">
                  <Link to={connectTarget} className="btn-primary inline-flex">
                    {t("connectBankLink")}
                  </Link>
                  <span className="text-muted text-sm">{t("or")}</span>
                  <Link to="/settings#spiir" className="btn-secondary inline-flex">
                    {t("importSpiirLink")}
                  </Link>
                </div>
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((acc) => {
                const txns = txByAccount.get(acc.uid) ?? [];
                const balance = acc.balance ?? txns.reduce((s, tx) => s + tx.amount, 0);
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
              {!isDemo && (
                <Link
                  to={connectTarget}
                  className="card p-4 flex flex-col items-center justify-center gap-2 text-muted hover:text-accent hover:border-accent/40 hover:bg-surface-2/50 hover:shadow-sm transition-all"
                >
                  <PlusIcon size={20} />
                  <span className="text-sm">{t("actions.newAccount")}</span>
                </Link>
              )}
            </div>
          ))
        }

        {tab === "transactions" &&
          (recent.length > 0 ? (
            <TransactionTable
              transactions={recent}
              title={
                selectedMonthBar
                  ? t("txTitleSelected", { month: selectedMonthBar.label })
                  : t("txTitleRecent")
              }
              onCategoryChange={async (txId, catId) => {
                await setCategoryId(txId, catId);
                refresh();
                if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
                autosaveTimer.current = setTimeout(() => void doAutosave(), 3000);
              }}
              onIsExtraordinaryChange={async (txId, value) => {
                await setIsExtraordinary(txId, value);
                refresh();
                if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
                autosaveTimer.current = setTimeout(() => void doAutosave(), 3000);
              }}
              onCustomDateChange={async (txId, date) => {
                await setCustomDate(txId, date);
                refresh();
              }}
            />
          ) : (
            <div className="card p-10 text-center text-muted text-sm">
              {t("noTransactionsThisMonth")}
            </div>
          ))
        }

        {dashDialog && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setDashDialog(false)}
          >
            <div
              className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-text mb-1">{t("dashboard:backup.dialogTitle")}</h3>
              <p className="text-xs text-muted mb-4">{t("dashboard:backup.dialogHint")}</p>
              <Input
                label={t("common:dialog.passwordLabel")}
                type="password"
                placeholder={t("common:dialog.passwordPlaceholder")}
                value={dashPassphrase}
                onChange={(e) => setDashPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickSave(dashPassphrase);
                  if (e.key === "Escape") setDashDialog(false);
                }}
                className="mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setDashDialog(false)}>
                  {t("common:actions.cancel")}
                </Button>
                <Button onClick={() => void handleQuickSave(dashPassphrase)}>
                  {t("common:actions.save")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
