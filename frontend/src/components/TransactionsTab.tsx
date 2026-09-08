import { useTranslation } from "react-i18next";
import TransactionTable from "./transactions/TransactionTable";
import EmptyState from "./ui/EmptyState";
import type { ViewTransaction } from "../lib/transactionView";
import { setCategoryId } from "../lib/data";

interface Props {
  transactions: ViewTransaction[];
  subtitle?: string;
  refresh: () => void;
}

export default function TransactionsTab({ transactions, subtitle, refresh }: Props) {
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
    />
  );
}
