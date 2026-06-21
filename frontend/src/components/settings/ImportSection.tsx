import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import CsvImportPanel from "../CsvImport";
import SpiirImportPanel from "../SpiirImport";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { detectDuplicatePairs, filterVisiblePairs } from "../../lib/duplicates";
import { getDismissedPairs } from "../../lib/settings";
import { getAllTransactions, type Transaction } from "../../lib/store";

export default function ImportSection({ highlightedHash }: { highlightedHash: string | null }) {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [importSource, setImportSource] = useState<"spiir" | "own">("spiir");
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatePairs, setDuplicatePairs] = useState<[Transaction, Transaction][] | null>(null);

  const runDuplicateCheck = useCallback(async () => {
    setCheckingDuplicates(true);
    try {
      const [all, dismissed] = await Promise.all([getAllTransactions(), getDismissedPairs()]);
      const pairs = detectDuplicatePairs(all);
      setDuplicatePairs(filterVisiblePairs(pairs, new Set(dismissed)));
    } finally {
      setCheckingDuplicates(false);
    }
  }, []);

  return (
    <>
      <Card
        id="spiir"
        className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#spiir" ? "ring-2 ring-accent" : ""}`}
      >
        <h2 className="text-sm font-semibold text-text mb-3">{t("settings:import.title")}</h2>

        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="importSource"
              value="spiir"
              checked={importSource === "spiir"}
              onChange={() => setImportSource("spiir")}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-xs text-text">{t("settings:import.sourceSpiir")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="importSource"
              value="own"
              checked={importSource === "own"}
              onChange={() => setImportSource("own")}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-xs text-text">{t("settings:import.sourceOwn")}</span>
          </label>
        </div>

        {importSource === "spiir" ? (
          <SpiirImportPanel onSuccess={() => navigate("/dashboard", { state: { checkDuplicates: true } })} />
        ) : (
          <CsvImportPanel />
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:duplicates.title")}</h2>
        <p className="text-xs text-muted mb-3">{t("settings:duplicates.description")}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button loading={checkingDuplicates} onClick={() => void runDuplicateCheck()}>
            {checkingDuplicates ? t("settings:duplicates.checking") : t("settings:duplicates.check")}
          </Button>
          {duplicatePairs !== null && (
            duplicatePairs.length === 0 ? (
              <span className="text-xs text-positive">{t("settings:duplicates.noneFound")}</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-warning">
                  {t("settings:duplicates.found", { count: duplicatePairs.length })}
                </span>
                <Button variant="ghost" onClick={() => navigate("/duplicates")}>
                  {t("settings:duplicates.review")}
                </Button>
              </div>
            )
          )}
        </div>
      </Card>
    </>
  );
}
