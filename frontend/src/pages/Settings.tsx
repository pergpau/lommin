import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { DownloadIcon, FileUpIcon, UploadIcon } from "../components/ui/icons";
import { loadEncryptedFile, saveEncryptedFile } from "../lib/cryptoFile";
import {
  DriveAuthError,
  loadBackupFromDrive,
  saveBackupToDrive,
  signInWithGoogle,
} from "../lib/googleDrive";
import { clearKey, importPemKey, loadKey, saveKey } from "../lib/keystore";
import { getAllSettings, setSetting } from "../lib/settings";
import {
  buildImportPayload,
  buildImportPayloadFromZip,
  parseSpiirCsvAccounts,
  parseSpiirZipAccounts,
  type SpiirAccount,
} from "../lib/spiirImport";
import {
  clearAccounts,
  clearTransactions,
  exportAll,
  getAccounts,
  importAll,
  type Account,
} from "../lib/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function Settings() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [hasKey, setHasKey] = useState(true);
  const [spiirHighlighted, setSpiirHighlighted] = useState(false);
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (hash === "#spiir") {
        setSpiirHighlighted(true);
        const t = setTimeout(() => setSpiirHighlighted(false), 1200);
        return () => clearTimeout(t);
      }
    }
  }, [hash]);
  const pemInputRef = useRef<HTMLInputElement>(null);
  const [pemState, setPemState] = useState<"idle" | "loading" | "confirm" | "done" | "error">("idle");
  const [pemAppId, setPemAppId] = useState("");
  const [pemError, setPemError] = useState("");
  const [pemDragging, setPemDragging] = useState(false);
  const pendingPemKey = useRef<CryptoKey | null>(null);
  const [proxyUrl, setProxyUrl] = useState("");
  const [lookbackDays, setLookbackDays] = useState("");
  const [appId, setAppId] = useState("");
  const [savingAppId, setSavingAppId] = useState(false);
  const [savingLookback, setSavingLookback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<"save" | "load" | null>(null);
  const [dialog, setDialog] = useState<"save" | "load" | "drive-save" | "drive-load" | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveSyncing, setDriveSyncing] = useState<"connect" | "save" | "load" | null>(null);
  const [driveMsg, setDriveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dialogPassphrase, setDialogPassphrase] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipingAccounts, setWipingAccounts] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Spiir import state
  const spiirFileRef = useRef<HTMLInputElement>(null);
  const spiirZipRef = useRef<HTMLInputElement>(null);
  const [spiirMode, setSpiirMode] = useState<"csv" | "zip">("csv");
  const [spiirStep, setSpiirStep] = useState<"idle" | "mapping" | "importing">("idle");
  const [spiirText, setSpiirText] = useState("");
  const [spiirZipBuf, setSpiirZipBuf] = useState<ArrayBuffer | null>(null);
  const [spiirAccounts, setSpiirAccounts] = useState<SpiirAccount[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Account[]>([]);
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const [spiirMsg, setSpiirMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    getAllSettings().then((s) => {
      setProxyUrl(s.proxyUrl);
      setLookbackDays(String(s.lookbackDays));
    });
    loadKey().then((kv) => {
      setHasKey(!!kv);
      if (kv) setAppId(kv.appId);
    });
  }, []);

  const processPemFile = useCallback(async (file: File) => {
    setPemState("loading");
    setPemError("");
    try {
      const pem = await file.text();
      const stem = file.name.replace(/(\.(pem|crt|key))+$/i, "");
      const key = await importPemKey(pem);
      pendingPemKey.current = key;
      setPemAppId(stem);
      setPemState("confirm");
    } catch (e) {
      setPemError(e instanceof Error ? e.message : "Klarte ikke å importere nøkkelen");
      setPemState("error");
    }
  }, []);

  const confirmPemKey = useCallback(async () => {
    if (!pendingPemKey.current || !pemAppId.trim()) return;
    try {
      await saveKey(pendingPemKey.current, pemAppId.trim());
      setAppId(pemAppId.trim());
      setHasKey(true);
      setPemState("idle");
    } catch (e) {
      setPemError(e instanceof Error ? e.message : "Klarte ikke å lagre nøkkelen");
      setPemState("error");
    }
  }, [pemAppId]);

  const saveProxy = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      await setSetting("proxyUrl", proxyUrl.trim());
      setMsg({ type: "ok", text: "Proxy-URL lagret." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Lagring feilet" });
    } finally {
      setSaving(false);
    }
  }, [proxyUrl]);

  const saveLookback = useCallback(async () => {
    setSavingLookback(true);
    setMsg(null);
    try {
      await setSetting("lookbackDays", parseInt(lookbackDays, 10));
      setMsg({ type: "ok", text: "Synkroniseringsperiode lagret." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Lagring feilet" });
    } finally {
      setSavingLookback(false);
    }
  }, [lookbackDays]);

  const saveAppIdFn = useCallback(async () => {
    const trimmed = appId.trim();
    if (!trimmed) return;
    setSavingAppId(true);
    setMsg(null);
    try {
      const kv = await loadKey();
      if (!kv) throw new Error("Ingen nøkkel lagret.");
      await saveKey(kv.key, trimmed);
      setAppId(trimmed);
      setMsg({ type: "ok", text: "App ID oppdatert." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Lagring feilet" });
    } finally {
      setSavingAppId(false);
    }
  }, [appId]);

  const openDialog = useCallback((mode: "save" | "load" | "drive-save" | "drive-load") => {
    setDialogPassphrase("");
    setDialog(mode);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogPassphrase("");
  }, []);

  const saveFile = useCallback(async () => {
    setDialog(null);
    setSyncing("save");
    setBackupMsg(null);
    try {
      const data = await exportAll();
      await saveEncryptedFile(data, dialogPassphrase);
      setBackupMsg({ type: "ok", text: "Sikkerhetskopi lagret." });
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setBackupMsg({ type: "err", text: e instanceof Error ? e.message : "Lagring feilet" });
    } finally {
      setSyncing(null);
      setDialogPassphrase("");
    }
  }, [dialogPassphrase]);

  const loadFile = useCallback(async () => {
    setDialog(null);
    setSyncing("load");
    setBackupMsg(null);
    try {
      const data = await loadEncryptedFile(dialogPassphrase);
      await importAll(data);
      setBackupMsg({ type: "ok", text: "Data hentet fra sikkerhetskopi." });
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setBackupMsg({ type: "err", text: e instanceof Error ? e.message : "Lasting feilet" });
    } finally {
      setSyncing(null);
      setDialogPassphrase("");
    }
  }, [dialogPassphrase]);

  const connectDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setDriveSyncing("connect");
    setDriveMsg(null);
    try {
      const token = await signInWithGoogle(GOOGLE_CLIENT_ID);
      setDriveToken(token);
    } catch (e) {
      setDriveMsg({ type: "err", text: e instanceof Error ? e.message : "Tilkobling feilet" });
    } finally {
      setDriveSyncing(null);
    }
  }, []);

  const saveDrive = useCallback(async () => {
    if (!driveToken) return;
    setDialog(null);
    setDriveSyncing("save");
    setDriveMsg(null);
    try {
      const data = await exportAll();
      await saveBackupToDrive(driveToken, data, dialogPassphrase);
      setDriveMsg({ type: "ok", text: "Sikkerhetskopi lagret til Google Drive." });
    } catch (e) {
      if (e instanceof DriveAuthError) setDriveToken(null);
      setDriveMsg({ type: "err", text: e instanceof Error ? e.message : "Lagring feilet" });
    } finally {
      setDriveSyncing(null);
      setDialogPassphrase("");
    }
  }, [driveToken, dialogPassphrase]);

  const loadDrive = useCallback(async () => {
    if (!driveToken) return;
    setDialog(null);
    setDriveSyncing("load");
    setDriveMsg(null);
    try {
      const data = await loadBackupFromDrive(driveToken, dialogPassphrase);
      await importAll(data);
      setDriveMsg({ type: "ok", text: "Data hentet fra Google Drive." });
    } catch (e) {
      if (e instanceof DriveAuthError) setDriveToken(null);
      setDriveMsg({ type: "err", text: e instanceof Error ? e.message : "Lasting feilet" });
    } finally {
      setDriveSyncing(null);
      setDialogPassphrase("");
    }
  }, [driveToken, dialogPassphrase]);

  const forgetKey = useCallback(async () => {
    await clearKey();
    navigate("/setup");
  }, [navigate]);

  const wipeAccounts = useCallback(async () => {
    if (!confirm("Slett alle kontoer og tilhørende transaksjoner? Dette kan ikke angres.")) return;
    setWipingAccounts(true);
    setMsg(null);
    try {
      await clearTransactions();
      await clearAccounts();
      setMsg({ type: "ok", text: "Alle kontoer og transaksjoner er slettet." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Sletting feilet" });
    } finally {
      setWipingAccounts(false);
    }
  }, []);

  const wipeTransactions = useCallback(async () => {
    if (
      !confirm(
        "Slett alle lagrede transaksjoner? Kontoene forblir tilkoblet; neste synkronisering henter dem på nytt.",
      )
    )
      return;
    setWiping(true);
    setMsg(null);
    try {
      await clearTransactions();
      setMsg({
        type: "ok",
        text: "Transaksjoner slettet. Kjør Synkroniser på oversikten for å hente på nytt.",
      });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Sletting feilet" });
    } finally {
      setWiping(false);
    }
  }, []);

  const onSpiirFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpiirMsg(null);
    const text = await file.text();
    const parsed = parseSpiirCsvAccounts(text);
    if (parsed.length === 0) {
      setSpiirMsg({
        type: "err",
        text: "Fant ingen kontoer i filen. Sjekk at filen er en gyldig Spiir-eksport.",
      });
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
  }, []);

  const onSpiirZipChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpiirMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseSpiirZipAccounts(buf);
      if (parsed.length === 0) {
        setSpiirMsg({
          type: "err",
          text: "Fant ingen kontoer i ZIP-filen. Sjekk at filen er en gyldig Spiir dataeksport.",
        });
        return;
      }
      const existing = await getAccounts();
      const initMap: Record<string, string> = {};
      for (const a of parsed) {
        const normBban = (s: string) => s.replace(/\D/g, "");
        const match = existing.find(
          (acc) =>
            (a.iban && acc.iban && a.iban === acc.iban) ||
            (a.bban && acc.bban && normBban(a.bban) === normBban(acc.bban)),
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
      setSpiirMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Kunne ikke lese ZIP-filen.",
      });
    } finally {
      if (spiirZipRef.current) spiirZipRef.current.value = "";
    }
  }, []);

  const doSpiirImport = useCallback(async () => {
    setSpiirStep("importing");
    setSpiirMsg(null);
    try {
      const payload =
        spiirMode === "zip"
          ? await buildImportPayloadFromZip(spiirZipBuf!, accountMap)
          : buildImportPayload(spiirText, accountMap);
      const { inserted, skipped } = await importAll({ ...payload, cursors: [] });
      const skipNote = skipped > 0 ? ` (${skipped} hoppet over – fantes allerede)` : "";
      setSpiirMsg({
        type: "ok",
        text: `Importerte ${inserted} transaksjoner fra ${spiirAccounts.length} konto${spiirAccounts.length !== 1 ? "er" : ""}${skipNote}.`,
      });
      setSpiirStep("idle");
    } catch (e) {
      setSpiirMsg({ type: "err", text: e instanceof Error ? e.message : "Import feilet" });
      setSpiirStep("mapping");
    }
  }, [spiirMode, spiirText, spiirZipBuf, accountMap, spiirAccounts]);

  const cancelSpiirImport = useCallback(() => {
    setSpiirStep("idle");
    setSpiirMsg(null);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-text mb-6">Innstillinger</h1>

      {msg && (
        <Alert type={msg.type === "ok" ? "ok" : "error"} message={msg.text} className="mb-6" />
      )}

      {!hasKey && (
        <Card className="p-5 mb-4 border-accent/30 bg-accent/5">
          <h2 className="text-sm font-semibold text-text mb-1">Importer signeringsnøkkel</h2>
          <p className="text-xs text-muted mb-4">
            Ingen nøkkel er lagret. Last opp <span className="mono">.pem</span>-filen fra Enable Banking for å aktivere synkronisering.
          </p>
          <input
            ref={pemInputRef}
            type="file"
            accept=".pem,.crt,.key,application/x-pem-file,text/plain"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processPemFile(f); }}
          />
          {pemState !== "confirm" && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${pemDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/40 hover:bg-surface/50"}`}
              onDragEnter={(e) => { e.preventDefault(); setPemDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); setPemDragging(true); }}
              onDragLeave={() => setPemDragging(false)}
              onDrop={(e) => { e.preventDefault(); setPemDragging(false); const f = e.dataTransfer.files[0]; if (f) processPemFile(f); }}
              onClick={() => pemInputRef.current?.click()}
            >
              {pemState === "loading" ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full" />
                  <span className="text-muted text-xs">Importerer nøkkel…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileUpIcon size={20} className="text-muted" />
                  <div>
                    <div className="text-sm text-text font-medium">{pemDragging ? "Slipp for å importere" : "Slipp .pem-fila her"}</div>
                    <div className="text-xs text-muted mt-0.5">eller klikk for å velge fil</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {pemState === "confirm" && (
            <div className="space-y-3">
              <Input
                label="App ID"
                value={pemAppId}
                onChange={(e) => setPemAppId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmPemKey(); }}
                className="font-mono"
                autoFocus
              />
              <Button onClick={confirmPemKey} disabled={!pemAppId.trim()}>
                Lagre nøkkel
              </Button>
            </div>
          )}
          {pemState === "error" && <Alert type="error" message={pemError} className="mt-3" />}
        </Card>
      )}

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">CORS Proxy</h2>
        <p className="text-xs text-muted mb-3">
          Alle Enable Banking API-kall rutes gjennom denne proxyen. Deploy worker med{" "}
          <span className="mono text-text/70">wrangler deploy</span>.
        </p>
        <div className="mb-4 border border-warning/20 bg-warning/5 rounded-lg p-3">
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-text/80 font-medium">Tillitsgrense:</span> den standard hostede
            proxyen videresender trafikken din og kan se transaksjonsdata og ditt kortlivede
            tilgangstoken (aldri signeringsnøkkelen). For fullt privat data, kjør din egen proxy og
            pek denne URL-en dit.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            label="Proxy-URL"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder="https://proxy.lommin.workers.dev"
            className="flex-1"
          />
          <div className="self-end">
            <Button loading={saving} onClick={saveProxy}>
              Lagre
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">App ID</h2>
        <p className="text-xs text-muted mb-3">
          ID-en som identifiserer applikasjonen din hos Enable Banking. Må stemme nøyaktig med
          ID-en i{" "}
          <a
            href="https://enablebanking.com/sign-in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Enable Banking-dashbordet
          </a>
          .
        </p>
        <div className="flex gap-2">
          <Input
            label="App ID"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveAppIdFn(); }}
            placeholder="f.eks. abc123de-f456-..."
            className="flex-1 font-mono"
          />
          <div className="self-end">
            <Button loading={savingAppId} onClick={saveAppIdFn} disabled={!appId.trim()}>
              Lagre
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">Synkronisering</h2>
        <p className="text-xs text-muted mb-3">
          Hvor langt tilbake første synkronisering av en konto henter transaksjoner. Senere
          synkroniseringer fortsetter der forrige slapp.
        </p>
        <div className="flex gap-2">
          <Input
            label="Historikk ved første synk (dager)"
            type="number"
            min={1}
            max={3650}
            value={lookbackDays}
            onChange={(e) => setLookbackDays(e.target.value)}
            className="flex-1"
          />
          <div className="self-end">
            <Button loading={savingLookback} onClick={saveLookback}>
              Lagre
            </Button>
          </div>
        </div>
      </Card>

      <Card id="backup" className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">Lagre og gjenopprett</h2>
        <p className="text-xs text-muted mb-4">
          Sikkerhetskopier dataene dine kryptert. Passordet forlater aldri enheten.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted mb-2">Google Drive</p>
            {driveMsg && (
              <Alert
                type={driveMsg.type === "ok" ? "ok" : "error"}
                message={driveMsg.text}
                className="mb-2"
              />
            )}
            {!GOOGLE_CLIENT_ID ? (
              <p className="text-xs text-muted">
                Google Drive er ikke konfigurert.{" "}
                <span className="mono text-text/70">VITE_GOOGLE_CLIENT_ID</span> mangler i
                byggemiljøet.
              </p>
            ) : !driveToken ? (
              <Button loading={driveSyncing === "connect"} onClick={connectDrive}>
                Koble til Google Drive
              </Button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="flex-1 justify-center"
                  loading={driveSyncing === "save"}
                  disabled={!!driveSyncing}
                  onClick={() => openDialog("drive-save")}
                >
                  <DownloadIcon size={13} />
                  Lagre til Drive
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-center"
                  loading={driveSyncing === "load"}
                  disabled={!!driveSyncing}
                  onClick={() => openDialog("drive-load")}
                >
                  <UploadIcon size={13} />
                  Last fra Drive
                </Button>
                <Button
                  variant="ghost"
                  disabled={!!driveSyncing}
                  onClick={() => setDriveToken(null)}
                >
                  Koble fra
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          <div>
            <p className="text-xs font-medium text-muted mb-2">Lokal fil</p>
            {backupMsg && (
              <Alert
                type={backupMsg.type === "ok" ? "ok" : "error"}
                message={backupMsg.text}
                className="mb-2"
              />
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1 justify-center"
                loading={syncing === "save"}
                disabled={!!syncing}
                onClick={() => openDialog("save")}
              >
                <DownloadIcon size={13} />
                Lagre fil
              </Button>
              <Button
                variant="ghost"
                className="flex-1 justify-center"
                loading={syncing === "load"}
                disabled={!!syncing}
                onClick={() => openDialog("load")}
              >
                <UploadIcon size={13} />
                Last inn fil
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card
        id="spiir"
        className={`p-5 mb-4 transition-shadow duration-300 ${spiirHighlighted ? "ring-2 ring-accent" : ""}`}
      >
        <h2 className="text-sm font-semibold text-text mb-1">Importer fra Spiir</h2>
        <p className="text-xs text-muted mb-4">
          Importer historiske transaksjoner fra Spiir. Velg CSV-eksport for enkel import, eller
          ZIP-eksport (full dataeksport) for bedre data med kontonavn, bank og kategorier fra Spiir.
          Duplikater hoppes over.
        </p>

        {spiirMsg && (
          <Alert
            type={spiirMsg.type === "ok" ? "ok" : "error"}
            message={spiirMsg.text}
            className="mb-3"
          />
        )}

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
                Velg CSV-fil
              </Button>
              <Button onClick={() => spiirZipRef.current?.click()}>
                <UploadIcon size={13} />
                Velg ZIP-eksport
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
                    <option value={`spiir::${sa.accountId}`}>Opprett ny konto</option>
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
                Importer
              </Button>
              <Button
                variant="ghost"
                disabled={spiirStep === "importing"}
                onClick={cancelSpiirImport}
              >
                Avbryt
              </Button>
            </div>
          </>
        )}
      </Card>

      {dialog && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={closeDialog}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-text mb-1">
              {dialog === "save"
                ? "Lagre sikkerhetskopi"
                : dialog === "load"
                  ? "Last inn sikkerhetskopi"
                  : dialog === "drive-save"
                    ? "Lagre til Google Drive"
                    : "Last fra Google Drive"}
            </h3>
            <p className="text-xs text-muted mb-4">
              {dialog === "save" || dialog === "drive-save"
                ? "Valgfritt: beskytt filen med et passord. La feltet stå tomt for å lagre uten kryptering."
                : "Skriv inn passordet du brukte ved lagring, eller la feltet stå tomt."}
            </p>
            <Input
              label="Passord (valgfritt)"
              type="password"
              placeholder="La stå tomt for ingen kryptering"
              value={dialogPassphrase}
              onChange={(e) => setDialogPassphrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (dialog === "save") saveFile();
                  else if (dialog === "load") loadFile();
                  else if (dialog === "drive-save") saveDrive();
                  else if (dialog === "drive-load") loadDrive();
                }
                if (e.key === "Escape") closeDialog();
              }}
              className="mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={closeDialog}>
                Avbryt
              </Button>
              <Button
                onClick={
                  dialog === "save"
                    ? saveFile
                    : dialog === "load"
                      ? loadFile
                      : dialog === "drive-save"
                        ? saveDrive
                        : loadDrive
                }
              >
                {dialog === "save" || dialog === "drive-save" ? "Lagre" : "Last inn"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="p-5 border-negative/10">
        <h2 className="text-sm font-semibold text-text mb-1">Faresone</h2>
        <p className="text-xs text-muted mb-4">
          Fjerner signeringsnøkkelen fra IndexedDB. Du må importere{" "}
          <span className="mono">.pem</span>-filen på nytt. Eksisterende transaksjonsdata påvirkes
          ikke.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={forgetKey}>
            Glem signeringsnøkkel
          </Button>
          <Button variant="danger" loading={wiping} onClick={wipeTransactions}>
            Slett transaksjoner
          </Button>
          <Button variant="danger" loading={wipingAccounts} onClick={wipeAccounts}>
            Slett all kontoer
          </Button>
        </div>
      </Card>
    </div>
  );
}
