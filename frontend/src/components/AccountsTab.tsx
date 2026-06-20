import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AccountCard from "./AccountCard";
import EmptyState from "./ui/EmptyState";
import { PlusIcon } from "./ui/icons";
import type { Account, Transaction } from "../lib/store";

function isConnected(acc: Account) {
  return acc.sources.some((s) => s.type === "enableBanking");
}

function groupAndSort(accounts: Account[]): { bankKey: string; accs: Account[] }[] {
  const groups = new Map<string, Account[]>();
  for (const acc of accounts) {
    const key = acc.bankName?.trim() ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(acc);
  }

  for (const accs of groups.values()) {
    accs.sort((a, b) => {
      const diff = (isConnected(b) ? 1 : 0) - (isConnected(a) ? 1 : 0);
      return diff !== 0 ? diff : (a.name ?? "").localeCompare(b.name ?? "");
    });
  }

  return [...groups.entries()]
    .map(([bankKey, accs]) => ({ bankKey, accs }))
    .sort((a, b) => {
      const connDiff = b.accs.filter(isConnected).length - a.accs.filter(isConnected).length;
      return connDiff !== 0 ? connDiff : a.bankKey.localeCompare(b.bankKey);
    });
}

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

  const groups = groupAndSort(accounts);

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ bankKey, accs }) => (
        <div key={bankKey}>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            {bankKey || t("unknownBank")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accs.map((acc) => {
              const txns = txByAccount.get(acc.uid) ?? [];
              const balance = acc.balance ?? txns.reduce((s, tx) => s + tx.amount, 0);
              return (
                <AccountCard
                  key={acc.uid}
                  acc={acc}
                  txns={txns}
                  balance={balance}
                  isSyncing={syncingAccountUids.has(acc.uid) && isConnected(acc)}
                  errorMsg={failedAccounts.get(acc.uid)}
                />
              );
            })}
          </div>
        </div>
      ))}
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
