import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { accountLabel, fmtAmount } from "../lib/format";
import { getLocale } from "../lib/i18n";
import { type Account, type Transaction } from "../lib/store";
import Button from "./ui/Button";
import { AlertCircleIcon } from "./ui/icons";
import Spinner from "./ui/Spinner";

interface Props {
  acc: Account;
  txns: Transaction[];
  balance: number;
  isSyncing: boolean;
  errorMsg?: string;
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

export default function AccountCard({ acc, txns, balance, isSyncing, errorMsg }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("components");

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
            <div className="text-sm font-medium text-text mt-0.5">{accountLabel(acc)}</div>
          </div>
          <AlertCircleIcon size={14} className="text-negative mt-1 flex-shrink-0" />
        </div>
        {(acc.bban || acc.iban) && (
          <div className="mono text-xs text-muted mb-2 truncate">{acc.bban ?? acc.iban}</div>
        )}
        {isRateLimit ? (
          <div className="text-xs text-muted">{t("accountCard.rateLimit")}</div>
        ) : (
          <>
            <div className="text-xs text-negative mb-3 line-clamp-2">{errorMsg}</div>
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
          {syncTime
            ? t("accountCard.lastSynced", { time: syncTime })
            : t("accountCard.notSynced")}
        </div>
      </Link>
    );
  }

  if (isSyncing) {
    return (
      <div className="card p-4 opacity-60">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-text mt-0.5">{accountLabel(acc)}</div>
          </div>
          <Spinner size={14} />
        </div>
        {(acc.bban || acc.iban) && (
          <div className="mono text-xs text-muted mb-2 truncate">{acc.bban ?? acc.iban}</div>
        )}
        <div className="text-xs text-muted">{t("accountCard.fetching")}</div>
        <div className="text-xs text-muted mt-3">{t("accountCard.syncing")}</div>
      </div>
    );
  }

  const isImported = acc.sources.some((s) => s.type === "spiir");
  const syncTime = fmtSyncTime(acc.balanceFetchedAt);

  return (
    <Link
      to={`/account/${acc.uid}`}
      className="card p-4 hover:border-accent/40 hover:bg-surface-2/50 hover:shadow-sm transition-all group"
    >
      <div className="mb-3">
        <div className="text-sm font-medium text-text group-hover:text-accent transition-colors">
          {accountLabel(acc)}
        </div>
      </div>
      {(acc.bban || acc.iban) && (
        <div className="mono text-xs text-muted mb-2 truncate">{acc.bban ?? acc.iban}</div>
      )}
      {!isImported && (
        <div
          className={`mono text-base font-semibold tabular-nums ${balance >= 0 ? "amount-positive" : "amount-negative"}`}
        >
          {fmtAmount(balance, acc.currency)}
        </div>
      )}
      <div className="text-xs text-muted mt-0.5">
        {t("accountCard.transactions", { count: txns.length })}
      </div>
      <div className="mt-2">
        {isImported ? (
          <span className="inline-flex items-center text-xs text-accent/80 bg-accent/8 border border-accent/20 rounded px-1.5 py-0.5 leading-none">
            {t("accountCard.importedFromSpiir")}
          </span>
        ) : (
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
