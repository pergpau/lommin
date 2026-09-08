import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteAccount,
  disconnectAccount,
  resetAccountSync,
  saveAccount,
  setCategoryId,
  type Account,
} from "../lib/data";
import { getSetting } from "../lib/settings";
import { accountLabel } from "../lib/format";
import { buildView, periodLabel } from "../lib/transactionView";
import { useAccounts } from "../hooks/useAccounts";
import { useAppMode } from "../hooks/useAppMode";
import { useTransactions } from "../hooks/useTransactions";
import { useSyncFeedback } from "../hooks/useSyncFeedback";
import LoadingScreen from "../components/ui/LoadingScreen";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Checkbox from "../components/ui/Checkbox";
import DropdownMenu, { DropdownItem } from "../components/ui/DropdownMenu";
import MonthlyChart, { type ChartMode } from "../components/charts/MonthlyChart";
import TransactionTable from "../components/transactions/TransactionTable";
import ResyncModal from "../components/ResyncModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { ArrowLeftIcon, RefreshCwIcon } from "../components/ui/icons";

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
      <Checkbox
        checked={account?.ownershipShare != null}
        onChange={(e) => {
          if (!account) return;
          onSave({ ...account, ownershipShare: e.target.checked ? 0.5 : undefined });
        }}
        label={t("sharedAccount")}
        textClassName="text-sm text-text"
      />
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
  const { syncing, syncSuccess, sessionExpiredUids, newTx, sync } = useSyncFeedback({
    accountUid: uid,
    onSynced: () => {
      reload();
      refresh();
    },
  });
  const isSessionExpired = sessionExpiredUids.has(uid ?? "");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("month");
  const { isDemo, hasKey } = useAppMode();

  const loading = accountsLoading || txLoading;

  const account = accounts.find((a) => a.uid === uid) ?? null;

  const txView = useMemo(
    () => buildView({ accounts: account ? [account] : [], transactions: all, mode: "full" }),
    [account, all],
  );

  const chartData = chartMode === "month" ? txView.monthly : txView.yearly;

  const filtered = useMemo(
    () => txView.transactionsIn(selectedMonth || null),
    [txView, selectedMonth],
  );

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
    void sync([account], { dateFrom });
  }, [account, resyncDays, sync]);

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
    return <LoadingScreen />;
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
              <Badge tone="positive" size="xs">
                {t("connectedBadge")}
              </Badge>
            )}
            {account?.ownershipShare != null && (
              <Badge tone="warning" size="xs">
                {t("common:shared", { pct: Math.round(account.ownershipShare * 100) })}
              </Badge>
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
              onClick={() => account && sync([account])}
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
          <DropdownMenu
            icon={<FontAwesomeIcon icon={faGear} className="w-[18px] h-[18px]" />}
            ariaLabel="Account settings"
            menuClassName="w-52"
          >
            {(close) => (
              <>
                <ShareSlider
                  account={account}
                  onSave={(updated) => void saveAccount(updated).then(reload)}
                />
                <div className="border-t border-border my-1" />
                {isConnected && (
                  <DropdownItem
                    onClick={() => {
                      close();
                      void openResyncModal();
                    }}
                  >
                    {t("forcedResync")}
                  </DropdownItem>
                )}
                {isConnected && (
                  <DropdownItem
                    onClick={() => {
                      close();
                      void disconnectBank();
                    }}
                  >
                    {t("disconnectAccount")}
                  </DropdownItem>
                )}
                <DropdownItem
                  onClick={() => {
                    close();
                    void resetSync();
                  }}
                >
                  {t("deleteTransactions")}
                </DropdownItem>
                <DropdownItem
                  danger
                  onClick={() => {
                    close();
                    void removeAccount();
                  }}
                >
                  {t("removeAccount")}
                </DropdownItem>
              </>
            )}
          </DropdownMenu>
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
        subtitle={selectedMonth ? periodLabel(selectedMonth) : undefined}
        onCategoryChange={async (txId, catId) => {
          await setCategoryId(txId, catId);
          refresh();
        }}
        onMutated={refresh}
        newTx={newTx}
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
