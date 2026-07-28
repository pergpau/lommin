import { useTranslation } from "react-i18next";
import TransactionTable from "./transactions/TransactionTable";
import EmptyState from "./ui/EmptyState";
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
    return <EmptyState message={t("noTransactionsThisMonth")} />;
  }

  return (
    <TransactionTable
      transactions={transactions}
      subtitle={subtitle}
      onCategoryChange={async (txId, catId) => {
        await setCategoryId(txId, catId);
        refresh();
      }}
      onMutated={refresh}
      shareMap={shareMap}
    />
  );
}
