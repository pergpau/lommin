import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import { UploadIcon } from "./ui/icons";
import { useSnackbar } from "./ui/Snackbar";
import {
  buildImportPayload,
  buildImportPayloadFromZip,
  parseSpiirCsvAccounts,
  parseSpiirZipAccounts,
  type SpiirAccount,
} from "../lib/spiirImport";
import { getAccounts, type Account } from "../lib/store";
import { importAll } from "../lib/mutations";

type Props = { onSuccess?: () => void };

export default function SpiirImportPanel({ onSuccess }: Props) {
  const { t } = useTranslation("components");
  const { showSnackbar } = useSnackbar();
  const spiirFileRef = useRef<HTMLInputElement>(null);
  const spiirZipRef = useRef<HTMLInputElement>(null);
  const [spiirMode, setSpiirMode] = useState<"csv" | "zip">("csv");
  const [spiirStep, setSpiirStep] = useState<"idle" | "mapping" | "importing">("idle");
  const [spiirText, setSpiirText] = useState("");
  const [spiirZipBuf, setSpiirZipBuf] = useState<ArrayBuffer | null>(null);
  const [spiirAccounts, setSpiirAccounts] = useState<SpiirAccount[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Account[]>([]);
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});

  const onSpiirFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
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
      if (spiirFileRef.current) spiirFileRef.current.value = "";
    },
    [showSnackbar, t],
  );

  const onSpiirZipChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
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
        showSnackbar(
          err instanceof Error ? err.message : t("spiirImport.unreadableZip"),
          "error",
        );
      } finally {
        if (spiirZipRef.current) spiirZipRef.current.value = "";
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
        <>
          <input
            ref={spiirFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onSpiirFileChange}
          />
          <input
            ref={spiirZipRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onSpiirZipChange}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => spiirFileRef.current?.click()}>
              <UploadIcon size={13} />
              {t("spiirImport.csvButton")}
            </Button>
            <Button onClick={() => spiirZipRef.current?.click()}>
              <UploadIcon size={13} />
              {t("spiirImport.zipButton")}
            </Button>
          </div>
        </>
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
                <select
                  className="text-xs border border-border rounded px-2 py-1.5 bg-surface text-text"
                  value={accountMap[sa.accountId] ?? `spiir::${sa.accountId}`}
                  onChange={(e) =>
                    setAccountMap((m) => ({ ...m, [sa.accountId]: e.target.value }))
                  }
                  disabled={spiirStep === "importing"}
                >
                  <option value={`spiir::${sa.accountId}`}>{t("spiirImport.newAccount")}</option>
                  {existingAccounts.map((acc) => (
                    <option key={acc.uid} value={acc.uid}>
                      {acc.name ?? acc.uid}
                    </option>
                  ))}
                </select>
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
