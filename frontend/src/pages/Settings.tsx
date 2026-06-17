import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BankSetupGuide from "../components/BankSetupGuide";
import PemImporter from "../components/PemImporter";
import SpiirImportPanel from "../components/SpiirImport";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { DownloadIcon, TrashIcon, UploadIcon } from "../components/ui/icons";
import Input from "../components/ui/Input";
import { useSnackbar } from "../components/ui/Snackbar";
import { loadEncryptedFile, saveEncryptedFile } from "../lib/cryptoFile";
import { isDemoMode } from "../lib/demoData";
import {
  DriveAuthError,
  loadBackupFromDrive,
  saveBackupToDrive,
  signInWithGoogle,
} from "../lib/googleDrive";
import { clearKey, loadKey, saveKey } from "../lib/keystore";
import { clearDriveToken, getAllSettings, getDriveToken, HOSTED_PROXY_URL, persistDriveToken, setSetting } from "../lib/settings";
import {
  clearAccounts,
  clearTransactions,
  exportAll,
  importAll,
} from "../lib/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function Settings() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [hasKey, setHasKey] = useState(true);
  const [highlightedHash, setHighlightedHash] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean | null>(null);
  useEffect(() => {
    if (!hash || isDemo === null || isDemo) return;
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedHash(hash);
    const t = setTimeout(() => setHighlightedHash(null), 1200);
    return () => clearTimeout(t);
  }, [hash, isDemo]);
  const [pemConfirming, setPemConfirming] = useState(false);
  const [pemAppId, setPemAppId] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const pendingPemKey = useRef<CryptoKey | null>(null);
  const [proxyMode, setProxyMode] = useState<"lommin" | "custom">("lommin");
  const [customProxyUrl, setCustomProxyUrl] = useState("");
  const [lookbackDays, setLookbackDays] = useState("");
  const [appId, setAppId] = useState("");
  const savedAppId = useRef("");
  const [savingAppId, setSavingAppId] = useState(false);
  const [savingLookback, setSavingLookback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<"save" | "load" | null>(null);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [backupMethod, setBackupMethod] = useState<"drive" | "file">("file");
  const [driveAutosave, setDriveAutosave] = useState(true);
  const [dialog, setDialog] = useState<"save" | "load" | "drive-save" | "drive-load" | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveSyncing, setDriveSyncing] = useState<"connect" | "save" | "load" | null>(null);
  const [dialogPassphrase, setDialogPassphrase] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipingAccounts, setWipingAccounts] = useState(false);
  const [wipingAll, setWipingAll] = useState(false);
  const [wipeAllDialog, setWipeAllDialog] = useState(false);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    isDemoMode().then(setIsDemo);
  }, []);

  useEffect(() => {
    getAllSettings().then((s) => {
      if (s.proxyUrl === HOSTED_PROXY_URL) {
        setProxyMode("lommin");
      } else {
        setProxyMode("custom");
        setCustomProxyUrl(s.proxyUrl);
      }
      setLookbackDays(String(s.lookbackDays));
      setUsePassphrase(s.usePassphrase);
      setBackupMethod(s.backupMethod);
      setDriveAutosave(s.driveAutosave);
    });
    loadKey().then((kv) => {
      setHasKey(!!kv);
      if (kv) { setAppId(kv.appId); savedAppId.current = kv.appId; }
    });
    getDriveToken().then((stored) => {
      if (stored) setDriveToken(stored.token);
    });
  }, []);

  const confirmPemKey = useCallback(async () => {
    if (!pendingPemKey.current || !pemAppId.trim()) return;
    try {
      await saveKey(pendingPemKey.current, pemAppId.trim());
      setAppId(pemAppId.trim());
      setHasKey(true);
      setPemConfirming(false);
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Klarte ikke å lagre nøkkelen", "error");
    }
  }, [pemAppId, showSnackbar]);

  const changeProxyMode = useCallback(async (mode: "lommin" | "custom") => {
    setProxyMode(mode);
    if (mode === "lommin") {
      try {
        await setSetting("proxyUrl", HOSTED_PROXY_URL);
        showSnackbar("Proxy satt til Lommin standard.", "ok");
      } catch (e) {
        showSnackbar(e instanceof Error ? e.message : "Lagring feilet", "error");
      }
    }
  }, [showSnackbar]);

  const saveProxy = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting("proxyUrl", customProxyUrl.trim());
      showSnackbar("Proxy-URL lagret.", "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Lagring feilet", "error");
    } finally {
      setSaving(false);
    }
  }, [customProxyUrl, showSnackbar]);

  const saveLookback = useCallback(async () => {
    setSavingLookback(true);
    try {
      await setSetting("lookbackDays", parseInt(lookbackDays, 10));
      showSnackbar("Synkroniseringsperiode lagret.", "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Lagring feilet", "error");
    } finally {
      setSavingLookback(false);
    }
  }, [lookbackDays, showSnackbar]);

  const saveAppIdFn = useCallback(async () => {
    const trimmed = appId.trim();
    if (!trimmed) return;
    setSavingAppId(true);
    try {
      const kv = await loadKey();
      if (!kv) throw new Error("Ingen nøkkel lagret.");
      await saveKey(kv.key, trimmed);
      setAppId(trimmed);
      savedAppId.current = trimmed;
      showSnackbar("App ID oppdatert.", "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Lagring feilet", "error");
    } finally {
      setSavingAppId(false);
    }
  }, [appId, showSnackbar]);

  const openDialog = useCallback((mode: "save" | "load" | "drive-save" | "drive-load") => {
    setDialogPassphrase("");
    setDialog(mode);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogPassphrase("");
  }, []);

  const changeBackupMethod = useCallback((method: "drive" | "file") => {
    setBackupMethod(method);
    void setSetting("backupMethod", method);
  }, []);

  const saveFile = useCallback(async (passphrase: string) => {
    setDialog(null);
    setSyncing("save");
    try {
      const data = await exportAll();
      await saveEncryptedFile(data, passphrase);
      showSnackbar("Sikkerhetskopi lagret.", "ok");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        showSnackbar(e instanceof Error ? e.message : "Lagring feilet", "error");
    } finally {
      setSyncing(null);
      setDialogPassphrase("");
    }
  }, [showSnackbar]);

  const loadFile = useCallback(async (passphrase: string) => {
    setDialog(null);
    setSyncing("load");
    try {
      const data = await loadEncryptedFile(passphrase);
      await importAll(data);
      showSnackbar("Data hentet fra sikkerhetskopi.", "ok");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
        const text = isDecryptErr
          ? passphrase
            ? "Feil passord."
            : "Filen er kryptert med passord. Huk av «Bruk passord» og prøv igjen."
          : e instanceof Error ? e.message : "Lasting feilet";
        showSnackbar(text, "error");
      }
    } finally {
      setSyncing(null);
      setDialogPassphrase("");
    }
  }, [showSnackbar]);

  const connectDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setDriveSyncing("connect");
    try {
      const { token, expiresIn } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(token, expiresIn);
      setDriveToken(token);
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Tilkobling feilet", "error");
    } finally {
      setDriveSyncing(null);
    }
  }, [showSnackbar]);

  const saveDrive = useCallback(async (passphrase: string) => {
    if (!driveToken) return;
    setDialog(null);
    setDriveSyncing("save");
    try {
      const data = await exportAll();
      await saveBackupToDrive(driveToken, data, passphrase);
      showSnackbar("Sikkerhetskopi lagret til Google Drive.", "ok");
    } catch (e) {
      if (e instanceof DriveAuthError) { setDriveToken(null); void clearDriveToken(); }
      showSnackbar(e instanceof Error ? e.message : "Lagring feilet", "error");
    } finally {
      setDriveSyncing(null);
      setDialogPassphrase("");
    }
  }, [driveToken, showSnackbar]);

  const loadDrive = useCallback(async (passphrase: string) => {
    if (!driveToken) return;
    setDialog(null);
    setDriveSyncing("load");
    try {
      const data = await loadBackupFromDrive(driveToken, passphrase);
      await importAll(data);
      showSnackbar("Data hentet fra Google Drive.", "ok");
    } catch (e) {
      if (e instanceof DriveAuthError) { setDriveToken(null); void clearDriveToken(); }
      const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
      const text = isDecryptErr
        ? passphrase
          ? "Feil passord."
          : "Filen er kryptert med passord. Huk av «Bruk passord» og prøv igjen."
        : e instanceof Error ? e.message : "Lasting feilet";
      showSnackbar(text, "error");
    } finally {
      setDriveSyncing(null);
      setDialogPassphrase("");
    }
  }, [driveToken, showSnackbar]);

  const forgetKey = useCallback(async () => {
    await clearKey();
    await clearDriveToken();
    navigate("/onboarding");
  }, [navigate]);

  const wipeAccounts = useCallback(async () => {
    if (!confirm("Slett alle kontoer og tilhørende transaksjoner? Dette kan ikke angres.")) return;
    setWipingAccounts(true);
    try {
      await clearTransactions();
      await clearAccounts();
      showSnackbar("Alle kontoer og transaksjoner er slettet.", "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Sletting feilet", "error");
    } finally {
      setWipingAccounts(false);
    }
  }, [showSnackbar]);

  const wipeTransactions = useCallback(async () => {
    if (
      !confirm(
        "Slett alle lagrede transaksjoner? Kontoene forblir tilkoblet; neste synkronisering henter dem på nytt.",
      )
    )
      return;
    setWiping(true);
    try {
      await clearTransactions();
      showSnackbar("Transaksjoner slettet. Kjør Synkroniser på oversikten for å hente på nytt.", "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Sletting feilet", "error");
    } finally {
      setWiping(false);
    }
  }, [showSnackbar]);

  const wipeAll = useCallback(async () => {
    setWipeAllDialog(false);
    setWipingAll(true);
    try {
      await clearTransactions();
      await clearAccounts();
      await clearKey();
      await clearDriveToken();
      navigate("/onboarding");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : "Sletting feilet", "error");
      setWipingAll(false);
    }
  }, [navigate, showSnackbar]);

  if (isDemo === null || isDemo) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-text mb-6">Innstillinger</h1>


      <Card id="pem" className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#pem" ? "ring-2 ring-accent" : ""} ${!hasKey ? "border-accent/30 bg-accent/5" : ""}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">Signeringsnøkkel</h2>
            {hasKey && (
              <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
                ✓ importert
              </span>
            )}
          </div>
          {hasKey && (
            <button
              className="inline-flex items-center gap-1 text-xs text-negative/70 hover:text-negative transition-colors"
              onClick={forgetKey}
            >
              <TrashIcon size={12} />
              Fjern nøkkel
            </button>
          )}
        </div>

        {hasKey ? (
          <div className="space-y-3 mt-4">
            <div>
              <Input
                label="App ID"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveAppIdFn(); }}
                placeholder="f.eks. abc123de-f456-..."
                className="w-full font-mono"
              />
            </div>
            <Button loading={savingAppId} onClick={saveAppIdFn} disabled={!appId.trim() || appId.trim() === savedAppId.current}>
              Oppdater
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Ingen nøkkel er lagret. Last opp <span className="mono">.pem</span>-filen fra Enable Banking for å aktivere synkronisering.
            </p>
            {!pemConfirming ? (
              <>
                <button
                  className="text-xs text-accent hover:underline"
                  onClick={() => setShowGuide((v) => !v)}
                >
                  {showGuide ? "Skjul guide" : "Trenger du hjelp med å skaffe nøkkelen?"}
                </button>
                {showGuide && (
                  <div className="border border-border rounded-xl p-4 mt-1">
                    <BankSetupGuide />
                  </div>
                )}
                <PemImporter
                  onImported={(key, appId) => {
                    pendingPemKey.current = key;
                    setPemAppId(appId);
                    setPemConfirming(true);
                  }}
                />
              </>
            ) : (
              <div className="space-y-3">
                <Input
                  label="App ID"
                  value={pemAppId}
                  onChange={(e) => setPemAppId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void confirmPemKey(); }}
                  className="font-mono"
                  autoFocus
                />
                <Button onClick={() => void confirmPemKey()} disabled={!pemAppId.trim()}>
                  Lagre nøkkel
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">CORS Proxy</h2>
        <p className="text-xs text-muted mb-3">
          Alle Enable Banking API-kall rutes gjennom denne proxyen. Deploy worker med{" "}
          <span className="mono text-text/70">wrangler deploy</span>.
        </p>

        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="proxyMode"
              value="lommin"
              checked={proxyMode === "lommin"}
              onChange={() => changeProxyMode("lommin")}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-xs text-text">Lommin proxy (standard)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="proxyMode"
              value="custom"
              checked={proxyMode === "custom"}
              onChange={() => changeProxyMode("custom")}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-xs text-text">Egendefinert</span>
          </label>
        </div>

        <div className="mb-4 border border-warning/20 bg-warning/5 rounded-lg p-3">
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-text/80 font-medium">OBS! </span>
            Lommis egen proxy videresender trafikken din til Enable Banking og kan i teorien lese dine transaksjonsdata og ditt kortlivede
            tilgangstoken (men aldri signeringsnøkkelen). Lommi lagrer ingen av dine data, men du må rett og slett bare stole på at det er sant. Hvis du ikke gjør det kan du velge å registrere din egen proxy her.
          </p>
        </div>

        {proxyMode === "custom" && (
          <div>
            <Input
              label="Proxy-URL"
              value={customProxyUrl}
              onChange={(e) => setCustomProxyUrl(e.target.value)}
              placeholder="https://din-proxy.workers.dev"
              className="mb-2"
            />
            <Button loading={saving} onClick={saveProxy}>
              Lagre
            </Button>
          </div>
        )}
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

      <Card id="backup" className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#backup" ? "ring-2 ring-accent" : ""}`}>
        <h2 className="text-sm font-semibold text-text mb-1">Lagre og gjenopprett</h2>
        <p className="text-xs text-muted mb-3">
          Sikkerhetskopier dataene dine kryptert. Passordet forlater aldri enheten.
        </p>

        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="backupMethod"
                value="drive"
                checked={backupMethod === "drive"}
                onChange={() => changeBackupMethod("drive")}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-xs text-text">Google Drive</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="backupMethod"
                value="file"
                checked={backupMethod === "file"}
                onChange={() => changeBackupMethod("file")}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-xs text-text">Lokal fil</span>
            </label>
          </div>

          {(backupMethod === "file" || (backupMethod === "drive" && !!driveToken)) && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={usePassphrase}
                onChange={(e) => { setUsePassphrase(e.target.checked); void setSetting("usePassphrase", e.target.checked); }}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-xs text-text">Bruk passord for å kryptere data</span>
            </label>
          )}

          {backupMethod === "drive" ? (
            <div>
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
                <div className="flex flex-col gap-3">
                  <label className={`flex items-start gap-2 cursor-pointer${usePassphrase ? " opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-accent mt-0.5 shrink-0"
                      checked={driveAutosave && !usePassphrase}
                      disabled={usePassphrase}
                      onChange={(e) => {
                        setDriveAutosave(e.target.checked);
                        void setSetting("driveAutosave", e.target.checked);
                      }}
                    />
                    <span className="text-xs text-text leading-snug">
                      Lagre automatisk til Drive
                      {usePassphrase && (
                        <span className="block text-muted mt-0.5">
                          Ikke tilgjengelig når passord er aktivert.
                        </span>
                      )}
                    </span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      className="flex-1 justify-center"
                      loading={driveSyncing === "save"}
                      disabled={!!driveSyncing}
                      onClick={() => usePassphrase ? openDialog("drive-save") : void saveDrive("")}
                    >
                      <DownloadIcon size={13} />
                      Lagre til Drive
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 justify-center"
                      loading={driveSyncing === "load"}
                      disabled={!!driveSyncing}
                      onClick={() => usePassphrase ? openDialog("drive-load") : void loadDrive("")}
                    >
                      <UploadIcon size={13} />
                      Last fra Drive
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!driveSyncing}
                      onClick={() => { setDriveToken(null); void clearDriveToken(); }}
                    >
                      Koble fra
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 justify-center"
                  loading={syncing === "save"}
                  disabled={!!syncing}
                  onClick={() => usePassphrase ? openDialog("save") : void saveFile("")}
                >
                  <DownloadIcon size={13} />
                  Lagre fil
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-center"
                  loading={syncing === "load"}
                  disabled={!!syncing}
                  onClick={() => usePassphrase ? openDialog("load") : void loadFile("")}
                >
                  <UploadIcon size={13} />
                  Last inn fil
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card
        id="spiir"
        className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#spiir" ? "ring-2 ring-accent" : ""}`}
      >
        <h2 className="text-sm font-semibold text-text mb-1">Importer fra Spiir</h2>
        <SpiirImportPanel />
      </Card>

      <Card id="import" className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">Import fra egne data</h2>
        <p className="text-xs text-muted">
          Kommer snart. Her vil du kunne importere transaksjoner fra egne CSV-filer og andre kilder.
        </p>
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
                  if (dialog === "save") saveFile(dialogPassphrase);
                  else if (dialog === "load") loadFile(dialogPassphrase);
                  else if (dialog === "drive-save") saveDrive(dialogPassphrase);
                  else if (dialog === "drive-load") loadDrive(dialogPassphrase);
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
                    ? () => saveFile(dialogPassphrase)
                    : dialog === "load"
                      ? () => loadFile(dialogPassphrase)
                      : dialog === "drive-save"
                        ? () => saveDrive(dialogPassphrase)
                        : () => loadDrive(dialogPassphrase)
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="danger" loading={wiping} onClick={wipeTransactions}>
            Slett transaksjoner
          </Button>
          <Button variant="danger" loading={wipingAccounts} onClick={wipeAccounts}>
            Slett alle kontoer
          </Button>
          <Button variant="danger" loading={wipingAll} onClick={() => setWipeAllDialog(true)}>
            Slett alt
          </Button>
        </div>
      </Card>

      {wipeAllDialog && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setWipeAllDialog(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-text mb-2">Slett alt</h3>
            <p className="text-xs text-muted mb-6">
              Dette sletter signeringsnøkkelen, alle kontoer og alle transaksjoner permanent.
              Du sendes tilbake til innledende oppsett. Handlingen kan ikke angres.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setWipeAllDialog(false)}>
                Avbryt
              </Button>
              <Button variant="danger" onClick={wipeAll}>
                Slett alt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
