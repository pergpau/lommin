import { useTranslation } from "react-i18next";
import TransactionTable from "./transactions/TransactionTable";
import type { Transaction } from "../lib/data";
import { setCategoryId } from "../lib/data";

interface Props {
  transactions: Transaction[];
  subtitle?: string;
  refresh: () => void;
  shareMap?: Map<string, number>;
}

export default function TransactionsTab({ transactions, subtitle, refresh, shareMap }: Props) {
  const { t } = useTranslation("dashboard");

  if (transactions.length === 0) {
    return (
      <div className="card p-10 text-center text-muted text-sm">
        {t("noTransactionsThisMonth")}
      </div>
    );
  }

  return (
    <TransactionTable
      transactions={transactions}
      subtitle={subtitle}
      onCategoryChange={async (txId, catId) => { await setCategoryId(txId, catId); refresh(); }}
      onMutated={refresh}
      shareMap={shareMap}
    />
  );
}
