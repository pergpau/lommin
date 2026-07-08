import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import type { Account, Transaction } from "../lib/data";
import { fmtAmount } from "../lib/format";
import { getLocale } from "../lib/i18n";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { AlertCircleIcon } from "./ui/icons";
import Spinner from "./ui/Spinner";

interface Props {
  acc: Account;
  txns: Transaction[];
  balance: number;
  isSyncing: boolean;
  errorMsg?: string;
  isSessionExpired?: boolean;
}

function fmtSyncTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString(getLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AccountBadges({
  isConnected,
  isImported,
  isShared,
  ownershipShare,
}: {
  isConnected: boolean;
  isImported: boolean;
  isShared: boolean;
  ownershipShare?: number;
}) {
  const { t } = useTranslation(["components", "common"]);
  return (
    <>
      {isConnected && <Badge tone="positive">{t("accountCard.connected")}</Badge>}
      {isImported && <Badge tone="accent">{t("accountCard.importedFromSpiir")}</Badge>}
      {isShared && (
        <Badge tone="warning">
          {t("common:shared", { pct: Math.round(ownershipShare! * 100) })}
        </Badge>
      )}
    </>
  );
}

export default function AccountCard({
  acc,
  txns,
  balance,
  isSyncing,
  errorMsg,
  isSessionExpired,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation(["components", "common"]);

  const isConnected = acc.sources.some((s) => s.type === "enableBanking");
  const isImported = acc.sources.some((s) => s.type === "spiir");
  const isShared = acc.ownershipShare != null;
  const label = acc.name?.trim() ?? acc.bankName?.trim() ?? "Account";

  if (errorMsg) {
    const isRateLimit = errorMsg.startsWith("429");
    const syncTime = fmtSyncTime(acc.balanceFetchedAt);
    return (
      <Link
        to={isRateLimit ? `/account/${acc.uid}` : "#"}
        className={`card p-4 border-negative/30 bg-negative/5${isRateLimit ? " hover:border-border-2 transition-colors" : ""}`}
        onClick={isRateLimit ? undefined : (e) => e.preventDefault()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-text">{label}</div>
          </div>
          <AlertCircleIcon size={14} className="text-negative mt-1 flex-shrink-0" />
        </div>
        {(acc.bban || acc.iban) && (
          <div className="mono text-xs text-muted mb-2 truncate">{acc.bban ?? acc.iban}</div>
        )}
        {isConnected && (
          <div className="mb-2">
            <Badge tone="positive">{t("accountCard.connected")}</Badge>
          </div>
        )}
        {isRateLimit ? (
          <div className="text-xs text-muted">{t("accountCard.rateLimit")}</div>
        ) : (
          <>
            <div className="text-xs text-negative mb-3 line-clamp-2">
              {isSessionExpired ? t("accountCard.sessionExpired") : errorMsg}
            </div>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={(e) => {
                e.preventDefault();
                const p = new URLSearchParams({ uid: acc.uid });
                if (acc.bankName) p.set("reauth", acc.bankName);
                if (acc.bankCountry) p.set("country", acc.bankCountry);
                navigate(`/connect?${p}`);
              }}
            >
              {t("accountCard.reconnect")}
            </Button>
          </>
        )}
        <div className="text-xs text-muted mt-3">
          {syncTime ? t("accountCard.lastSynced", { time: syncTime }) : t("accountCard.notSynced")}
        </div>
      </Link>
    );
  }

  if (isSyncing) {
    return (
      <div className={`card p-4 opacity-60${isConnected ? " !border-positive/70" : ""}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-text">{label}</div>
          </div>
          <Spinner size={14} />
        </div>
        {(acc.bban || acc.iban) && (
          <div className="mono text-xs text-muted mb-2 truncate">{acc.bban ?? acc.iban}</div>
        )}
        <div className="h-3.5 w-24 rounded bg-muted/20 animate-pulse mt-0.5" />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AccountBadges
            isConnected={isConnected}
            isImported={isImported}
            isShared={isShared}
            ownershipShare={acc.ownershipShare}
          />
        </div>
      </div>
    );
  }

  const syncTime = fmtSyncTime(acc.balanceFetchedAt);

  return (
    <Link
      to={`/account/${acc.uid}`}
      className={`card p-4 hover:border-accent/40 hover:bg-surface-2/50 hover:shadow-sm transition-all group${isConnected ? " !border-positive/70" : ""}`}
    >
      <div className="mb-3">
        <div className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
          {label}
        </div>
      </div>
      {(acc.bban || acc.iban) && (
        <div className="mono text-xs text-muted mb-2 truncate">{acc.bban ?? acc.iban}</div>
      )}
      {isConnected && (
        <div
          className={`mono text-base font-semibold tabular-nums ${balance >= 0 ? "amount-positive" : "amount-negative"}`}
        >
          {fmtAmount(balance, acc.currency)}
        </div>
      )}
      <div className="text-xs text-muted mt-0.5">
        {t("accountCard.transactions", { count: txns.length })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AccountBadges
          isConnected={isConnected}
          isImported={isImported}
          isShared={isShared}
          ownershipShare={acc.ownershipShare}
        />
        {isConnected && (
          <span className="text-xs text-muted">
            {syncTime
              ? t("accountCard.lastSynced", { time: syncTime })
              : t("accountCard.notSynced")}
          </span>
        )}
      </div>
    </Link>
  );
}
