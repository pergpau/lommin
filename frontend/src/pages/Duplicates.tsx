import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import DuplicatesList from "../components/transactions/DuplicatesList";
import Spinner from "../components/ui/Spinner";
import { detectDuplicatePairs, filterVisiblePairs, pairKey } from "../lib/duplicates";
import { deleteTransaction, setCategoryId, setComment, setCustomDate, setIsExtraordinary } from "../lib/mutations";
import { addDismissedPair, dismissAllPairs, getDismissedPairs } from "../lib/settings";
import { getAllTransactions, type Transaction } from "../lib/store";

export default function Duplicates() {
  const { t } = useTranslation("dashboard");
  const [pairs, setPairs] = useState<[Transaction, Transaction][] | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getAllTransactions(), getDismissedPairs()]).then(([txs, dismissed]) => {
      setPairs(detectDuplicatePairs(txs));
      setDismissedKeys(new Set(dismissed));
    });
  }, []);

  const reload = useCallback(async () => {
    const all = await getAllTransactions();
    setPairs(detectDuplicatePairs(all));
  }, []);

  const handleDismissPair = useCallback(async (key: string) => {
    await addDismissedPair(key);
    setDismissedKeys((prev) => new Set([...prev, key]));
  }, []);

  const handleDismissAll = useCallback(async () => {
    if (!pairs) return;
    const keys = pairs.map(([a, b]) => pairKey(a, b));
    await dismissAllPairs(keys);
    setDismissedKeys((prev) => new Set([...prev, ...keys]));
  }, [pairs]);

  if (pairs === null) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Spinner size={24} />
      </div>
    );
  }

  const visiblePairs = filterVisiblePairs(pairs, dismissedKeys);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("duplicates.modalTitle")}</h1>
          <p className="text-sm text-muted mt-0.5">{t("duplicates.pairCount", { count: visiblePairs.length })}</p>
        </div>
        {visiblePairs.length > 0 && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleDismissAll}
          >
            {t("duplicates.dismissAll")}
          </Button>
        )}
      </div>
      <DuplicatesList
        pairs={visiblePairs}
        onCategoryChange={async (txId, catId) => { await setCategoryId(txId, catId); await reload(); }}
        onDelete={async (txId) => { await deleteTransaction(txId); await reload(); }}
        onDismissPair={handleDismissPair}
        onIsExtraordinaryChange={async (txId, value) => { await setIsExtraordinary(txId, value); }}
        onCustomDateChange={async (txId, date) => { await setCustomDate(txId, date); }}
        onCommentChange={async (txId, comment) => { await setComment(txId, comment); }}
      />
    </div>
  );
}
