import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { triggerAutosave } from "../lib/backup";
import {
  deleteAccount,
  disconnectAccount,
  resetAccountSync,
  saveAccount,
  setCategoryId,
  type Account,
} from "../lib/data";
import { getSetting } from "../lib/settings";
import { accountLabel, effectiveDate } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { buildMonthlyData, buildYearlyData } from "../lib/transactionAggregation";
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
import { loadKey } from "../lib/auth";

function ShareSlider({
  account,
  onSave,
}: {
  account: Account | null | undefined;
  onSave: (acc: Account) => void;
}) {
  const { t } = useTranslation("account");
  const [draft, setDraft] = useState<number | null>(null);
  const share =
    draft ?? (account?.ownershipShare != null ? Math.round(account.ownershipShare * 100) : null);

  const commit = () => {
    if (!account || draft == null) return;
    onSave({ ...account, ownershipShare: draft / 100 });
    setDraft(null);
  };

  return (
    <div className="px-4 py-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={account?.ownershipShare != null}
          onChange={(e) => {
            if (!account) return;
            onSave({ ...account, ownershipShare: e.target.checked ? 0.5 : undefined });
          }}
          className="w-4 h-4 accent-accent"
        />
        <span className="text-sm text-text">{t("sharedAccount")}</span>
      </label>
      {share != null && (
        <div className="mt-2 px-0">
          <div className="text-xs text-muted mb-1">
            {share}% {t("ownershipShare")}
          </div>
          <input
            type="range"
            min={5}
            max={95}
            step={5}
            value={share}
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={commit}
            onTouchEnd={commit}
            className="w-full accent-accent h-1.5"
          />
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { t } = useTranslation(["account", "common"]);
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { accounts, loading: accountsLoading, reload } = useAccounts();
  const { transactions: all, loading: txLoading, refresh } = useTransactions(uid);
  const {
    syncing,
    syncProgress,
    syncMsg,
    error: syncError,
    failedAccounts,
    sessionExpiredUids,
    run: runSync,
  } = useSyncState();
  const accountError = failedAccounts.get(uid ?? "");
  const isSessionExpired = sessionExpiredUids.has(uid ?? "");
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
    if (syncProgress) showSnackbar(syncProgress, "info", null);
  }, [syncProgress, showSnackbar]);

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
    () => [...all].sort((a, b) => (effectiveDate(b) ?? "").localeCompare(effectiveDate(a) ?? "")),
    [all],
  );

  const monthlyData = useMemo<MonthBar[]>(() => buildMonthlyData(sorted), [sorted]);
  const yearlyData = useMemo<MonthBar[]>(() => buildYearlyData(sorted), [sorted]);

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
    void runSync(
      [account],
      (hadErrors) => {
        reload();
        refresh();
        if (!hadErrors) void triggerAutosave();
      },
      dateFrom,
    );
  }, [account, resyncDays, runSync, reload, refresh]);

  const disconnectBank = useCallback(async () => {
    if (!uid || !confirm(t("confirm.disconnectAccount"))) return;
    await disconnectAccount(uid);
    reload();
  }, [uid, t, reload]);

  const removeAccount = useCallback(async () => {
    if (!uid || !confirm(t("confirm.removeAccount"))) return;
    await deleteAccount(uid);
    navigate("/dashboard", { state: { tab: "accounts" } });
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
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/dashboard"
          state={{ tab: "accounts" }}
          className="text-muted hover:text-text transition-colors"
        >
          <ArrowLeftIcon size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text">
            {account ? accountLabel(account) : t("fallbackTitle")}
          </h1>
          {(account?.bban || account?.iban) && (
            <div className="mono text-xs text-muted">{account?.bban ?? account?.iban}</div>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            {isConnected && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20 leading-none">
                {t("connectedBadge")}
              </span>
            )}
            {account?.ownershipShare != null && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 leading-none">
                {t("common:shared", { pct: Math.round(account.ownershipShare * 100) })}
              </span>
            )}
          </div>
        </div>
        {/* Sync / Connect button — always visible */}
        <div className="flex items-center gap-2">
          {isConnected && isSessionExpired ? (
            <Button
              size="sm"
              variant="danger"
              disabled={!account}
              onClick={() => {
                if (!account) return;
                const p = new URLSearchParams({ uid: account.uid });
                if (account.bankName) p.set("reauth", account.bankName);
                if (account.bankCountry) p.set("country", account.bankCountry);
                navigate(`/connect?${p}`);
              }}
            >
              {t("reconnect")}
            </Button>
          ) : isConnected ? (
            <Button
              size="sm"
              loading={syncing}
              success={syncSuccess}
              disabled={!account}
              onClick={() =>
                account &&
                runSync([account], (hadErrors) => {
                  reload();
                  refresh();
                  if (!hadErrors) {
                    void triggerAutosave();
                    syncFlash();
                  }
                })
              }
            >
              <RefreshCwIcon size={12} />
              {t("sync")}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isDemo}
              onClick={() => {
                if (!hasKey) {
                  navigate("/settings#pem");
                  return;
                }
                const p = new URLSearchParams();
                if (account?.bankName) p.set("bank", account.bankName);
                if (account?.bankCountry) p.set("country", account.bankCountry);
                navigate(`/connect${p.toString() ? "?" + p.toString() : ""}`);
              }}
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
              {actionsOpen ? (
                <XIcon size={18} />
              ) : (
                <FontAwesomeIcon icon={faGear} className="w-[18px] h-[18px]" />
              )}
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 card py-1 z-30 shadow-lg">
                <ShareSlider
                  account={account}
                  onSave={(updated) => void saveAccount(updated).then(reload)}
                />
                <div className="border-t border-border my-1" />
                {isConnected && (
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                    onClick={() => {
                      setActionsOpen(false);
                      void openResyncModal();
                    }}
                  >
                    {t("forcedResync")}
                  </button>
                )}
                {isConnected && (
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                    onClick={() => {
                      setActionsOpen(false);
                      void disconnectBank();
                    }}
                  >
                    {t("disconnectAccount")}
                  </button>
                )}
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text hover:bg-surface-2 transition-colors text-left"
                  onClick={() => {
                    setActionsOpen(false);
                    void resetSync();
                  }}
                >
                  {t("deleteTransactions")}
                </button>
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-danger hover:bg-surface-2 transition-colors text-left"
                  onClick={() => {
                    setActionsOpen(false);
                    void removeAccount();
                  }}
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
            onModeChange={(m) => {
              setChartMode(m);
              setSelectedMonth("");
            }}
          />
        </div>
      )}

      <TransactionTable
        transactions={filtered}
        subtitle={
          selectedMonth
            ? chartMode === "year"
              ? selectedMonth
              : new Date(selectedMonth + "-15").toLocaleDateString(getLocale(), {
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
