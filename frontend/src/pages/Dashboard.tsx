import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AccountsTab from "../components/AccountsTab";
import TransactionsTab from "../components/TransactionsTab";
import MonthlyChart, { type ChartMode, type MonthBar } from "../components/charts/MonthlyChart";
import SpendingBreakdown from "../components/charts/SpendingBreakdown";
import Button from "../components/ui/Button";
import DropdownMenu, { DropdownItem, dropdownItemClass } from "../components/ui/DropdownMenu";
import LoadingScreen from "../components/ui/LoadingScreen";
import PassphraseDialog from "../components/ui/PassphraseDialog";
import { useSnackbar } from "../components/ui/Snackbar";
import Spinner from "../components/ui/Spinner";
import WarningBanner from "../components/ui/WarningBanner";
import {
  GoogleDriveIcon,
  HardDriveIcon,
  MenuIcon,
  RefreshCwIcon,
  XIcon,
} from "../components/ui/icons";
import { DEMO_ONLY } from "../constants";
import { useAccounts } from "../hooks/useAccounts";
import { useSuccessFlash } from "../hooks/useSuccessFlash";
import { useSwipe } from "../hooks/useSwipe";
import { useSyncState } from "../hooks/useSyncState";
import { useTransactions } from "../hooks/useTransactions";
import { loadKey } from "../lib/auth";
import { addSaveListener, BackupError, saveBackup, triggerAutosave } from "../lib/backup";
import {
  clearAccounts,
  clearTransactions,
  getAllTransactions,
  getEnableBankingSource,
  setCategoryId,
} from "../lib/data";
import { isDemoMode } from "../lib/demoData";
import { detectDuplicatePairs, filterVisiblePairs } from "../lib/duplicates";
import { effectiveDate } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { getAllSettings, getDismissedPairs, hasSetting } from "../lib/settings";
import { buildMonthlyData, buildYearlyData } from "../lib/transactionAggregation";

type Tab = "categories" | "accounts" | "transactions";
const TABS: Tab[] = ["categories", "transactions", "accounts"];

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
  const [dashBackupSaving, setDashBackupSaving] = useState(false);
  const [dashDialog, setDashDialog] = useState(false);
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
      setDashDialog(true);
    } else {
      void handleQuickSave("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBackupMethod, usePassphrase, navigate]);

  const handleQuickSave = useCallback(
    async (passphrase: string) => {
      setDashDialog(false);
      setDashBackupSaving(true);
      try {
        await saveBackup(passphrase);
        showSnackbar(
          t(backupMethod === "drive" ? "snackbar.savedToDrive" : "snackbar.savedToFile"),
          "ok",
        );
        saveFlash();
      } catch (e) {
        const kind = e instanceof BackupError ? e.kind : "unknown";
        if (kind === "drive-not-connected") {
          navigate("/settings#backup");
        } else if (kind !== "cancelled") {
          showSnackbar(
            e instanceof Error && e.message ? e.message : t("snackbar.saveFailed"),
            "error",
          );
        }
      } finally {
        setDashBackupSaving(false);
      }
    },
    [backupMethod, navigate, showSnackbar, t, saveFlash],
  );

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
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get("tab") as Tab | null;
  const stateTab = (location.state as { tab?: Tab } | null)?.tab;
  const defaultTab = !loading && accounts.length === 0 ? "accounts" : "categories";
  const tab: Tab =
    paramTab && TABS.includes(paramTab)
      ? paramTab
      : stateTab && TABS.includes(stateTab)
        ? stateTab
        : defaultTab;
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }), [setSearchParams]);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const categoryGoBackRef = useRef<(() => boolean) | null>(null);
  const swipeRef = useSwipe<HTMLDivElement>({
    onSwipe: (direction) => {
      if (direction === "right" && tab === "categories" && categoryGoBackRef.current?.()) {
        setSwipeDirection("right");
        return;
      }
      const i = TABS.indexOf(tab);
      if (direction === "left" && i < TABS.length - 1) {
        setSwipeDirection("left");
        setTab(TABS[i + 1]);
      } else if (direction === "right" && i > 0) {
        setSwipeDirection("right");
        setTab(TABS[i - 1]);
      }
    },
  });
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

  const shareMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      if (acc.ownershipShare != null) map.set(acc.uid, acc.ownershipShare);
    }
    return map;
  }, [accounts]);

  const scaledTransactions = useMemo(() => {
    if (shareMap.size === 0) return transactions;
    return transactions.map((tx) => {
      const share = shareMap.get(tx.accountUid);
      if (share == null) return tx;
      return { ...tx, amount: tx.amount * share };
    });
  }, [transactions, shareMap]);

  const monthlyData = useMemo<MonthBar[]>(
    () => buildMonthlyData(scaledTransactions),
    [scaledTransactions],
  );
  const yearlyData = useMemo<MonthBar[]>(
    () => buildYearlyData(scaledTransactions),
    [scaledTransactions],
  );

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
        .sort((a, b) => (effectiveDate(b) ?? "").localeCompare(effectiveDate(a) ?? "")),
    [transactions, activeMonth],
  );

  const selectedMonthBar = chartData.find((m) => m.key === activeMonth);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {isDemo && (
        <WarningBanner message={t("demo.banner")}>
          {!DEMO_ONLY && (
            <Button variant="ghost" size="sm" loading={exitingDemo} onClick={exitDemo}>
              {t("demo.exit")}
            </Button>
          )}
        </WarningBanner>
      )}
      {showDuplicatesBanner && (
        <WarningBanner message={t("duplicates.bannerText")}>
          <Button
            variant="ghost"
            size="sm"
            className="border border-warning/40 text-warning hover:text-warning hover:bg-warning/10"
            onClick={() => navigate("/duplicates")}
          >
            {t("duplicates.bannerAction")}
          </Button>
          <button
            onClick={() => setShowDuplicatesBanner(false)}
            className="p-1.5 text-warning/60 hover:text-warning transition-colors"
            aria-label={t("common:actions.close")}
          >
            <XIcon size={14} />
          </button>
        </WarningBanner>
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
          <Button
            loading={dashBackupSaving || autoSaving}
            success={saveSuccess}
            disabled={isDemo}
            onClick={handleQuickSaveClick}
          >
            <BackupIcon size={14} />
            {t("actions.save")}
          </Button>
          {hasLiveAccounts && (
            <Button
              loading={syncing}
              success={syncSuccess}
              onClick={() =>
                runSync(accounts, (hadErrors) => {
                  reload();
                  refresh();
                  if (!hadErrors) {
                    void doAutosave();
                    syncFlash();
                    void checkAndShowDuplicatesBanner();
                  }
                })
              }
            >
              <RefreshCwIcon size={14} />
              {t("actions.sync")}
            </Button>
          )}
        </div>

        {/* Mobile actions */}
        <div className="sm:hidden flex items-center gap-1">
          {hasLiveAccounts && (
            <button
              className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 disabled:opacity-40 transition-colors"
              disabled={syncing}
              onClick={() =>
                runSync(accounts, (hadErrors) => {
                  reload();
                  refresh();
                  if (!hadErrors) {
                    void doAutosave();
                    syncFlash();
                    void checkAndShowDuplicatesBanner();
                  }
                })
              }
              aria-label={syncing ? t("actions.syncing") : t("actions.sync")}
            >
              {syncing ? <Spinner size={18} /> : <RefreshCwIcon size={18} />}
            </button>
          )}
          <DropdownMenu icon={<MenuIcon size={18} />} ariaLabel={t("actions.mobile")}>
            {(close) => (
              <>
                {!isDemo && (
                  <Link
                    to={connectTarget}
                    className={`${dropdownItemClass} text-text`}
                    onClick={close}
                  >
                    {t("actions.addAccount")}
                  </Link>
                )}
                <DropdownItem
                  disabled={isDemo || dashBackupSaving || autoSaving}
                  onClick={() => {
                    close();
                    handleQuickSaveClick();
                  }}
                >
                  <BackupIcon size={13} />
                  {dashBackupSaving ? t("actions.saving") : t("actions.save")}
                </DropdownItem>
              </>
            )}
          </DropdownMenu>
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

      <div className="flex justify-between sm:justify-start gap-1 mb-6 border-b border-border">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            className={`flex-1 sm:flex-none text-center px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === tabKey
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
            onClick={() => setTab(tabKey)}
          >
            {t("tabs." + tabKey)}
          </button>
        ))}
      </div>

      <div
        ref={swipeRef}
        className={
          swipeDirection === "left"
            ? "animate-slide-in-left"
            : swipeDirection === "right"
              ? "animate-slide-in-right"
              : undefined
        }
        style={{ touchAction: "pan-y" }}
        onAnimationEnd={() => setSwipeDirection(null)}
      >
        {tab === "categories" && (
          <SpendingBreakdown
            transactions={recent}
            subtitle={
              selectedMonthBar
                ? chartMode === "year"
                  ? selectedMonthBar.key
                  : new Date(selectedMonthBar.key + "-15").toLocaleDateString(getLocale(), {
                      month: "long",
                      year: "numeric",
                    })
                : undefined
            }
            onCategoryChange={async (txId, catId) => {
              await setCategoryId(txId, catId);
              refresh();
            }}
            onMutated={refresh}
            goBackRef={categoryGoBackRef}
            shareMap={shareMap}
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
                  : new Date(selectedMonthBar.key + "-15").toLocaleDateString(getLocale(), {
                      month: "long",
                      year: "numeric",
                    })
                : undefined
            }
            refresh={refresh}
            shareMap={shareMap}
          />
        )}
      </div>

      {dashDialog && (
        <PassphraseDialog
          title={t("dashboard:backup.dialogTitle")}
          hint={t("dashboard:backup.dialogHint")}
          actionLabel={t("common:actions.save")}
          onSubmit={(passphrase) => void handleQuickSave(passphrase)}
          onClose={() => setDashDialog(false)}
        />
      )}
    </div>
  );
}
