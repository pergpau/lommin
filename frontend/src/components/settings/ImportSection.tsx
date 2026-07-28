import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import CsvImportPanel from "../CsvImport";
import SpiirImportPanel from "../SpiirImport";
import Button from "../ui/Button";
import SettingsSection from "./SettingsSection";
import Checkbox from "../ui/Checkbox";
import { detectDuplicatePairs, filterVisiblePairs } from "../../lib/duplicates";
import { getDismissedPairs } from "../../lib/settings";
import { getAllTransactions, type Transaction } from "../../lib/data";

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
      <SettingsSection
        id="spiir"
        highlightedHash={highlightedHash}
        title={t("settings:import.title")}
      >
        <div className="flex gap-4 mb-4">
          <Checkbox
            type="radio"
            name="importSource"
            value="spiir"
            checked={importSource === "spiir"}
            onChange={() => setImportSource("spiir")}
            label={t("settings:import.sourceSpiir")}
          />
          <Checkbox
            type="radio"
            name="importSource"
            value="own"
            checked={importSource === "own"}
            onChange={() => setImportSource("own")}
            label={t("settings:import.sourceOwn")}
          />
        </div>

        {importSource === "spiir" ? (
          <SpiirImportPanel
            onSuccess={() => navigate("/dashboard", { state: { checkDuplicates: true } })}
          />
        ) : (
          <CsvImportPanel />
        )}
      </SettingsSection>

      <SettingsSection
        title={t("settings:duplicates.title")}
        description={t("settings:duplicates.description")}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Button loading={checkingDuplicates} onClick={() => void runDuplicateCheck()}>
            {checkingDuplicates
              ? t("settings:duplicates.checking")
              : t("settings:duplicates.check")}
          </Button>
          {duplicatePairs !== null &&
            (duplicatePairs.length === 0 ? (
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
            ))}
        </div>
      </SettingsSection>
    </>
  );
}
