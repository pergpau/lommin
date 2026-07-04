import { getAccounts, type Account } from "../lib/data";
import { useAsyncData } from "./useAsyncData";

export function useAccounts() {
  const { data, loading, error, reload } = useAsyncData<Account[]>(getAccounts, []);
  return { accounts: data, loading, error, reload };
}
