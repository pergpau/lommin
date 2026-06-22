import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AccountsTab from "../components/AccountsTab";
import TransactionsTab from "../components/TransactionsTab";
import MonthlyChart, { type ChartMode, type MonthBar } from "../components/charts/MonthlyChart";
import SpendingBreakdown from "../components/charts/SpendingBreakdown";
import Button from "../components/ui/Button";
import { useSnackbar } from "../components/ui/Snackbar";
import { GoogleDriveIcon, HardDriveIcon, MenuIcon, RefreshCwIcon, XIcon } from "../components/ui/icons";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";
import { useAccounts } from "../hooks/useAccounts";
import { useSyncState } from "../hooks/useSyncState";
import { useTransactions } from "../hooks/useTransactions";
import { saveEncryptedFile } from "../lib/cryptoFile";
import { isDemoMode } from "../lib/demoData";
import { DriveAuthError, saveBackupToDrive } from "../lib/googleDrive";
import { loadKey } from "../lib/auth";
import { effectiveDate } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { buildMonthlyData, buildYearlyData } from "../lib/transactionAggregation";
import { clearDriveToken, getAllSettings, getDismissedPairs, getDriveToken, hasSetting } from "../lib/settings";
import { detectDuplicatePairs, filterVisiblePairs } from "../lib/duplicates";
import { addSaveListener, triggerAutosave } from "../lib/autosave";
import { useSuccessFlash } from "../hooks/useSuccessFlash";
import { clearAccounts, clearTransactions, exportAll, getAllTransactions, getEnableBankingSource } from "../lib/store";
import { setCategoryId } from "../lib/mutations";

type Tab = "categories" | "accounts" | "transactions";

export default function Dashboard() {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, loading: accountsLoading, reload } = useAccounts();
  const { transactions, loading: txLoading, refresh } = useTransactions();
  const {
    syncing,
    syncProgress,
    syncMsg,
    error,
    failedAccounts,
    sessionExpiredUids,
    syncingAccountUids,
    run: runSync,
  } = useSyncState();
  const { showSnackbar } = useSnackbar();
  const [hasKey, setHasKey] = useState(true);
  const [backupMethod, setBackupMethod] = useState<"drive" | "file">("file");
  const [hasBackupMethod, setHasBackupMethod] = useState(false);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [dashDriveToken, setDashDriveToken] = useState<string | null>(null);
  const [dashBackupSaving, setDashBackupSaving] = useState(false);
  const [dashDialog, setDashDialog] = useState(false);
  const [dashPassphrase, setDashPassphrase] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [exitingDemo, setExitingDemo] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  useEffect(() => addSaveListener(setAutoSaving), []);
  const doAutosave = useCallback(() => void triggerAutosave(), []);
  const { success: saveSuccess, flash: saveFlash } = useSuccessFlash();
  const { success: syncSuccess, flash: syncFlash } = useSuccessFlash();

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
    hasSetting("backupMethod").then(setHasBackupMethod);

  }, []);

  useEffect(() => {
    if (syncProgress) showSnackbar(syncProgress, "info", null);
  }, [syncProgress, showSnackbar]);

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
    if (!hasBackupMethod) {
      navigate("/settings#backup");
      return;
    }
    if (usePassphrase) {
      setDashPassphrase("");
      setDashDialog(true);
    } else {
      void handleQuickSave("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBackupMethod, usePassphrase, backupMethod, dashDriveToken, navigate]);

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
        saveFlash();
      } else {
        await saveEncryptedFile(data, passphrase);
        showSnackbar(t("snackbar.savedToFile"), "ok");
        saveFlash();
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
  }, [backupMethod, dashDriveToken, navigate, showSnackbar, t, saveFlash]);

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
      const stateTab = (location.state as { tab?: Tab } | null)?.tab;
      if (stateTab) setTab(stateTab);
      else if (accounts.length === 0) setTab("accounts");
    }
  }, [loading, accounts.length, location.state]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showDuplicatesBanner, setShowDuplicatesBanner] = useState(false);

  const checkAndShowDuplicatesBanner = useCallback(async () => {
    const [all, dismissed] = await Promise.all([getAllTransactions(), getDismissedPairs()]);
    const visible = filterVisiblePairs(detectDuplicatePairs(all), new Set(dismissed));
    if (visible.length > 0) setShowDuplicatesBanner(true);
  }, []);

  useEffect(() => {
    if (!location.state?.checkDuplicates) return;
    void checkAndShowDuplicatesBanner();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthlyData = useMemo<MonthBar[]>(() => buildMonthlyData(transactions), [transactions]);
  const yearlyData = useMemo<MonthBar[]>(() => buildYearlyData(transactions), [transactions]);

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
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {isDemo && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 flex items-center justify-between mb-6">
          <span className="text-sm text-warning font-medium">{t("demo.banner")}</span>
          <Button variant="ghost" size="sm" loading={exitingDemo} onClick={exitDemo}>
            {t("demo.exit")}
          </Button>
        </div>
      )}
      {showDuplicatesBanner && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-6">
          <span className="text-sm text-warning font-medium">{t("duplicates.bannerText")}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="border border-warning/40 text-warning hover:text-warning hover:bg-warning/10" onClick={() => navigate("/duplicates")}>
              {t("duplicates.bannerAction")}
            </Button>
            <button
              onClick={() => setShowDuplicatesBanner(false)}
              className="p-1.5 text-warning/60 hover:text-warning transition-colors"
              aria-label={t("common:actions.close")}
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>
      )}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold">{t("title")}</h1>
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
            <Button loading={dashBackupSaving || autoSaving} success={saveSuccess} disabled={isDemo} onClick={handleQuickSaveClick}>
              <BackupIcon size={14} />
              {t("actions.save")}
            </Button>
            {hasLiveAccounts && (
              <Button
                loading={syncing}
                success={syncSuccess}
                onClick={() => runSync(accounts, (hadErrors) => { reload(); refresh(); if (!hadErrors) { void doAutosave(); syncFlash(); void checkAndShowDuplicatesBanner(); } })}
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
                      runSync(accounts, (hadErrors) => { reload(); refresh(); if (!hadErrors) { void doAutosave(); syncFlash(); void checkAndShowDuplicatesBanner(); } });
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
            subtitle={
              selectedMonthBar
                ? chartMode === "year"
                  ? selectedMonthBar.key
                  : new Date(selectedMonthBar.key + "-15").toLocaleDateString(getLocale(), { month: "long", year: "numeric" })
                : undefined
            }
            onCategoryChange={async (txId, catId) => { await setCategoryId(txId, catId); refresh(); }}
            onMutated={refresh}
          />
        )}

        {tab === "accounts" && (
          <AccountsTab
            accounts={accounts}
            txByAccount={txByAccount}
            syncingAccountUids={syncingAccountUids}
            failedAccounts={failedAccounts}
            sessionExpiredUids={sessionExpiredUids}
            isDemo={isDemo}
            connectTarget={connectTarget}
          />
        )}

        {tab === "transactions" && (
          <TransactionsTab
            transactions={recent}
            subtitle={
              selectedMonthBar
                ? chartMode === "year"
                  ? selectedMonthBar.key
                  : new Date(selectedMonthBar.key + "-15").toLocaleDateString(getLocale(), { month: "long", year: "numeric" })
                : undefined
            }
            refresh={refresh}
          />
        )}

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
  );
}
