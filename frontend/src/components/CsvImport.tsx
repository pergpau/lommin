import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import Button from "./ui/Button";
import { useSnackbar } from "./ui/Snackbar";
import {
  buildCsvTransactions,
  detectCsvCurrency,
  parseCsvImport,
  type CsvTransactionDraft,
  type ParseError,
} from "../lib/csvImport";
import { importAll, saveAccount } from "../lib/mutations";
import { getAccounts, type Account } from "../lib/store";

type Step = "idle" | "preview" | "importing";

type AccountChoice =
  | { kind: "existing"; uid: string }
  | { kind: "new"; name: string };

function dateRange(drafts: CsvTransactionDraft[]): string {
  if (drafts.length === 0) return "";
  const dates = drafts.map((d) => d.bookingDate).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? first : `${first} – ${last}`;
}

export default function CsvImportPanel() {
  const { t } = useTranslation("components");
  const { showSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("idle");
  const [drafts, setDrafts] = useState<CsvTransactionDraft[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Account[]>([]);
  const [choice, setChoice] = useState<AccountChoice>({ kind: "new", name: "" });

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (fileRef.current) fileRef.current.value = "";

      const text = await file.text();
      const { drafts: parsed, errors } = parseCsvImport(text);

      if (parsed.length === 0 && errors.length > 0 && errors[0].row === 0) {
        showSnackbar(errors[0].message, "error");
        return;
      }

      const accounts = await getAccounts();
      setDrafts(parsed);
      setParseErrors(errors);
      setExistingAccounts(accounts);
      setChoice(
        accounts.length > 0
          ? { kind: "existing", uid: accounts[0].uid }
          : { kind: "new", name: file.name.replace(/\.csv$/i, "") },
      );
      setStep("preview");
    },
    [showSnackbar],
  );

  const doImport = useCallback(async () => {
    setStep("importing");
    try {
      let accountUid: string;
      let accountCurrency: string;

      if (choice.kind === "existing") {
        const acc = existingAccounts.find((a) => a.uid === choice.uid);
        accountUid = choice.uid;
        accountCurrency = acc?.currency ?? detectCsvCurrency(drafts);
      } else {
        accountUid = crypto.randomUUID();
        accountCurrency = detectCsvCurrency(drafts);
        const newAccount: Account = {
          uid: accountUid,
          name: choice.name.trim() || t("csvImport.defaultAccountName"),
          currency: accountCurrency,
          addedAt: Date.now(),
          sources: [{ type: "manual", sourceId: accountUid }],
        };
        await saveAccount(newAccount);
      }

      const transactions = buildCsvTransactions(drafts, accountUid, accountCurrency);
      const { inserted, skipped } = await importAll({
        accounts: [],
        transactions,
        cursors: [],
      });

      const skipNote =
        skipped > 0 ? t("csvImport.skipNote", { skipped }) : "";
      showSnackbar(t("csvImport.success", { count: inserted, skipNote }), "ok");
      setStep("idle");
      navigate("/dashboard", { state: { checkDuplicates: true } });
    } catch (e) {
      showSnackbar(
        e instanceof Error ? e.message : t("csvImport.importFailed"),
        "error",
      );
      setStep("preview");
    }
  }, [choice, drafts, existingAccounts, showSnackbar, navigate, t]);

  const cancel = useCallback(() => {
    setStep("idle");
    setDrafts([]);
    setParseErrors([]);
  }, []);

  return (
    <>
      <p className="text-xs text-muted mb-3">{t("csvImport.description")}</p>
      <ul className="space-y-1.5 mb-4">
        {(
          [
            ["booking_date", t("csvImport.columns.bookingDate")],
            ["transaction_date", t("csvImport.columns.transactionDate")],
            ["amount", t("csvImport.columns.amount")],
            ["description", t("csvImport.columns.description")],
            ["id", t("csvImport.columns.id")],
            ["currency", t("csvImport.columns.currency")],
            ["status", t("csvImport.columns.status")],
          ] as [string, string][]
        ).map(([col, note]) => (
          <li key={col} className="flex items-baseline gap-1.5 text-xs">
            <code className="font-mono text-[0.95em] text-text/80 bg-surface border border-border rounded px-1 shrink-0">
              {col}
            </code>
            {note && <span className="text-muted">{note}</span>}
          </li>
        ))}
      </ul>

      {step === "idle" && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onFileChange}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <FontAwesomeIcon icon={faUpload} className="mr-1.5" />
            {t("csvImport.uploadButton")}
          </Button>
        </>
      )}

      {(step === "preview" || step === "importing") && (
        <>
          <p className="text-xs text-text mb-1">
            {t("csvImport.preview", { count: drafts.length, range: dateRange(drafts) })}
          </p>

          {parseErrors.length > 0 && (
            <ul className="mb-3 space-y-1">
              {parseErrors.map((err) => (
                <li key={err.row} className="text-xs text-negative">
                  {err.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted">{t("csvImport.accountLabel")}</span>

              <select
                className="text-xs border border-border rounded px-2 py-1.5 bg-surface text-text"
                value={choice.kind === "existing" ? choice.uid : "__new__"}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setChoice({ kind: "new", name: "" });
                  } else {
                    setChoice({ kind: "existing", uid: e.target.value });
                  }
                }}
                disabled={step === "importing"}
              >
                <option value="__new__">{t("csvImport.newAccount")}</option>
                {existingAccounts.map((acc) => (
                  <option key={acc.uid} value={acc.uid}>
                    {acc.name ?? acc.uid}
                  </option>
                ))}
              </select>
            </div>

            {choice.kind === "new" && (
              <input
                type="text"
                className="text-xs border border-border rounded px-2 py-1.5 bg-surface text-text w-full max-w-xs"
                placeholder={t("csvImport.accountNamePlaceholder")}
                value={choice.name}
                onChange={(e) => setChoice({ kind: "new", name: e.target.value })}
                disabled={step === "importing"}
              />
            )}
          </div>

          <div className="flex gap-2">
            <Button
              loading={step === "importing"}
              disabled={drafts.length === 0}
              onClick={() => void doImport()}
            >
              {t("csvImport.import")}
            </Button>
            <Button variant="ghost" disabled={step === "importing"} onClick={cancel}>
              {t("csvImport.cancel")}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
