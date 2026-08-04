import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_IMPORT_BYTES } from "../constants";
import { getAccounts, importAll, type Account } from "../lib/data";
import {
  buildImportPayload,
  buildImportPayloadFromZip,
  parseSpiirCsvAccounts,
  parseSpiirZipAccounts,
  type SpiirAccount,
} from "../lib/spiirImport";
import Button from "./ui/Button";
import FilePickerButton from "./ui/FilePickerButton";
import Select from "./ui/Select";
import { UploadIcon } from "./ui/icons";
import { useSnackbar } from "./ui/Snackbar";

type Props = { onSuccess?: () => void };

export default function SpiirImportPanel({ onSuccess }: Props) {
  const { t } = useTranslation("components");
  const { showSnackbar } = useSnackbar();
  const [spiirMode, setSpiirMode] = useState<"csv" | "zip">("csv");
  const [spiirStep, setSpiirStep] = useState<"idle" | "mapping" | "importing">("idle");
  const [spiirText, setSpiirText] = useState("");
  const [spiirZipBuf, setSpiirZipBuf] = useState<ArrayBuffer | null>(null);
  const [spiirAccounts, setSpiirAccounts] = useState<SpiirAccount[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Account[]>([]);
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});

  const onSpiirFileChange = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMPORT_BYTES) {
        showSnackbar(t("spiirImport.fileTooLarge"), "error");
        return;
      }
      const text = await file.text();
      const parsed = parseSpiirCsvAccounts(text);
      if (parsed.length === 0) {
        showSnackbar(t("spiirImport.noAccounts"), "error");
        return;
      }
      const existing = await getAccounts();
      const initMap: Record<string, string> = {};
      for (const a of parsed) initMap[a.accountId] = `spiir::${a.accountId}`;
      setSpiirText(text);
      setSpiirMode("csv");
      setSpiirAccounts(parsed);
      setExistingAccounts(existing);
      setAccountMap(initMap);
      setSpiirStep("mapping");
    },
    [showSnackbar, t],
  );

  const onSpiirZipChange = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMPORT_BYTES) {
        showSnackbar(t("spiirImport.fileTooLarge"), "error");
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const parsed = await parseSpiirZipAccounts(buf);
        if (parsed.length === 0) {
          showSnackbar(t("spiirImport.noAccountsZip"), "error");
          return;
        }
        const existing = await getAccounts();
        const initMap: Record<string, string> = {};
        for (const a of parsed) {
          const normBban = (s: string) => s.replace(/\D/g, "");
          const match = existing.find(
            (acc) =>
              (a.iban && acc.iban && a.iban === acc.iban) ||
              (a.bban && acc.bban && normBban(a.bban) === normBban(acc.bban)) ||
              acc.sources.some((s) => s.type === "spiir" && s.sourceId === a.accountId),
          );
          initMap[a.accountId] = match ? match.uid : `spiir::${a.accountId}`;
        }
        const sorted = [...parsed].sort((a, b) => {
          const aMatched = !initMap[a.accountId].startsWith("spiir::");
          const bMatched = !initMap[b.accountId].startsWith("spiir::");
          return Number(bMatched) - Number(aMatched);
        });
        setSpiirZipBuf(buf);
        setSpiirMode("zip");
        setSpiirAccounts(sorted);
        setExistingAccounts(existing);
        setAccountMap(initMap);
        setSpiirStep("mapping");
      } catch (err) {
        showSnackbar(err instanceof Error ? err.message : t("spiirImport.unreadableZip"), "error");
      }
    },
    [showSnackbar, t],
  );

  const doSpiirImport = useCallback(async () => {
    setSpiirStep("importing");
    try {
      const payload =
        spiirMode === "zip"
          ? await buildImportPayloadFromZip(spiirZipBuf!, accountMap)
          : buildImportPayload(spiirText, accountMap);
      const { inserted, skipped } = await importAll({ ...payload, cursors: [] });
      const skipNote = skipped > 0 ? t("spiirImport.skipNote", { skipped }) : "";
      showSnackbar(
        t("spiirImport.success", { count: spiirAccounts.length, txCount: inserted, skipNote }),
        "ok",
      );
      setSpiirStep("idle");
      onSuccess?.();
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("spiirImport.importFailed"), "error");
      setSpiirStep("mapping");
    }
  }, [spiirMode, spiirText, spiirZipBuf, accountMap, spiirAccounts, showSnackbar, onSuccess, t]);

  const cancelSpiirImport = useCallback(() => {
    setSpiirStep("idle");
  }, []);

  return (
    <>
      <p className="text-xs text-muted mb-4">{t("spiirImport.description")}</p>

      {spiirStep === "idle" && (
        <div className="flex gap-2">
          <FilePickerButton
            variant="ghost"
            accept=".csv"
            onFile={(file) => void onSpiirFileChange(file)}
          >
            <UploadIcon size={13} />
            {t("spiirImport.csvButton")}
          </FilePickerButton>
          <FilePickerButton accept=".zip" onFile={(file) => void onSpiirZipChange(file)}>
            <UploadIcon size={13} />
            {t("spiirImport.zipButton")}
          </FilePickerButton>
        </div>
      )}

      {(spiirStep === "mapping" || spiirStep === "importing") && (
        <>
          <div className="mb-4 space-y-3">
            {spiirAccounts.map((sa) => (
              <div key={sa.accountId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{sa.name}</div>
                  <div className="text-xs text-muted">
                    {[sa.bankName, sa.bban, sa.currency].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Select
                  value={accountMap[sa.accountId] ?? `spiir::${sa.accountId}`}
                  onChange={(e) => setAccountMap((m) => ({ ...m, [sa.accountId]: e.target.value }))}
                  disabled={spiirStep === "importing"}
                >
                  <option value={`spiir::${sa.accountId}`}>{t("spiirImport.newAccount")}</option>
                  {existingAccounts.map((acc) => (
                    <option key={acc.uid} value={acc.uid}>
                      {acc.name ?? acc.uid}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button loading={spiirStep === "importing"} onClick={doSpiirImport}>
              {t("spiirImport.import")}
            </Button>
            <Button
              variant="ghost"
              disabled={spiirStep === "importing"}
              onClick={cancelSpiirImport}
            >
              {t("spiirImport.cancel")}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
