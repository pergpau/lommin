import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AccountCard from "./AccountCard";
import EmptyState from "./ui/EmptyState";
import { PlusIcon } from "./ui/icons";
import type { Account, Transaction } from "../lib/store";

interface Props {
  accounts: Account[];
  txByAccount: Map<string, Transaction[]>;
  syncingAccountUids: Set<string>;
  failedAccounts: Map<string, string>;
  isDemo: boolean;
  connectTarget: string;
}

export default function AccountsTab({ accounts, txByAccount, syncingAccountUids, failedAccounts, isDemo, connectTarget }: Props) {
  const { t } = useTranslation("dashboard");

  if (accounts.length === 0) {
    return (
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
    );
  }

  return (
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
  );
}
