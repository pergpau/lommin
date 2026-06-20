import { useTranslation } from "react-i18next";
import TransactionTable from "./transactions/TransactionTable";
import type { Transaction } from "../lib/store";
import { deleteTransaction, setCategoryId, setComment, setCustomDate, setIsExtraordinary } from "../lib/mutations";

interface Props {
  transactions: Transaction[];
  subtitle?: string;
  refresh: () => void;
}

export default function TransactionsTab({ transactions, subtitle, refresh }: Props) {
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
      onIsExtraordinaryChange={async (txId, value) => { await setIsExtraordinary(txId, value); refresh(); }}
      onCustomDateChange={async (txId, date) => { await setCustomDate(txId, date); refresh(); }}
      onCommentChange={async (txId, comment) => { await setComment(txId, comment); refresh(); }}
      onDelete={async (txId) => { await deleteTransaction(txId); refresh(); }}
    />
  );
}
