import { getAllTransactions, getTransactionsForAccount, type Transaction } from "../lib/data";
import { useAsyncData } from "./useAsyncData";

export function useTransactions(accountUid?: string) {
  const { data, loading, error, reload } = useAsyncData<Transaction[]>(
    () => (accountUid ? getTransactionsForAccount(accountUid) : getAllTransactions()),
    [],
    [accountUid],
  );
  return { transactions: data, loading, error, refresh: reload };
}
