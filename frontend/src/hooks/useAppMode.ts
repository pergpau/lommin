import { loadKey } from "../lib/auth";
import { isDemoMode } from "../lib/demoData";
import { useAsyncData } from "./useAsyncData";

// Whether a signing key exists and whether the app is in demo mode, plus where
// "add account" should send the user. `hasKey` is optimistic until loaded so
// pages don't flash the no-key state on mount.
export function useAppMode() {
  const { data, loading } = useAsyncData(
    async () => {
      const [kv, isDemo] = await Promise.all([loadKey(), isDemoMode()]);
      return { hasKey: !!kv, isDemo };
    },
    { hasKey: true, isDemo: false },
  );
  return {
    ...data,
    loading,
    connectTarget: data.hasKey ? "/connect" : "/settings#pem",
  };
}
