import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
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
import { detectDuplicatePairs, filterVisiblePairs } from "../lib/duplicates";
import {
  DriveAuthError,
  loadBackupFromDrive,
  saveBackupToDrive,
  signInWithGoogle,
} from "../lib/googleDrive";
import { clearKey, loadKey, saveKey } from "../lib/keystore";
import { clearDismissedPairs, clearDriveToken, getAllSettings, getDismissedPairs, getDriveToken, getSetting, HOSTED_PROXY_URL, persistDriveToken, setSetting } from "../lib/settings";
import {
  clearAccounts,
  clearTransactions,
  exportAll,
  getAllTransactions,
  importAll,
  type Transaction,
} from "../lib/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function Settings() {
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [hasKey, setHasKey] = useState(true);
  const [highlightedHash, setHighlightedHash] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean | null>(null);
  useEffect(() => {
    if (!hash || isDemo === null || isDemo) return;
    const el = document.querySelector(hash);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setHighlightedHash(hash);
    const timer = setTimeout(() => setHighlightedHash(null), 1200);
    return () => clearTimeout(timer);
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
  const [restorePreview, setRestorePreview] = useState<{
    data: object;
    fileCount: number;
    localCount: number;
    remoteSavedAt: number | null;
    localSavedAt: number | null;
  } | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveSyncing, setDriveSyncing] = useState<"connect" | "save" | "load" | null>(null);
  const [dialogPassphrase, setDialogPassphrase] = useState("");
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatePairs, setDuplicatePairs] = useState<[Transaction, Transaction][] | null>(null);
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
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveKeyFailed"), "error");
    }
  }, [pemAppId, showSnackbar, t]);

  const changeProxyMode = useCallback(async (mode: "lommin" | "custom") => {
    setProxyMode(mode);
    if (mode === "lommin") {
      try {
        await setSetting("proxyUrl", HOSTED_PROXY_URL);
        showSnackbar(t("settings:snackbar.proxySet"), "ok");
      } catch (e) {
        showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
      }
    }
  }, [showSnackbar, t]);

  const saveProxy = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting("proxyUrl", customProxyUrl.trim());
      showSnackbar(t("settings:snackbar.proxySaved"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }, [customProxyUrl, showSnackbar, t]);

  const saveLookback = useCallback(async () => {
    setSavingLookback(true);
    try {
      await setSetting("lookbackDays", parseInt(lookbackDays, 10));
      showSnackbar(t("settings:snackbar.syncPeriodSaved"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSavingLookback(false);
    }
  }, [lookbackDays, showSnackbar, t]);

  const saveAppIdFn = useCallback(async () => {
    const trimmed = appId.trim();
    if (!trimmed) return;
    setSavingAppId(true);
    try {
      const kv = await loadKey();
      if (!kv) throw new Error(t("settings:snackbar.noKey"));
      await saveKey(kv.key, trimmed);
      setAppId(trimmed);
      savedAppId.current = trimmed;
      showSnackbar(t("settings:snackbar.appIdUpdated"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSavingAppId(false);
    }
  }, [appId, showSnackbar, t]);

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

  const saveFile = useCallback(async (passphrase: string) => {
    setDialog(null);
    setSyncing("save");
    try {
      const data = await exportAll();
      await saveEncryptedFile(data, passphrase);
      void setSetting("lastLocalSavedAt", Date.now());
      showSnackbar(t("settings:snackbar.savedToFile"), "ok");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSyncing(null);
      setDialogPassphrase("");
    }
  }, [showSnackbar, t]);

  const loadFile = useCallback(async (passphrase: string) => {
    setDialog(null);
    setSyncing("load");
    try {
      const data = await loadEncryptedFile(passphrase);
      await importAll(data);
      showSnackbar(t("settings:snackbar.restoreSuccess"), "ok");
      navigate("/dashboard", { state: { checkDuplicates: true } });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
        const text = isDecryptErr
          ? passphrase
            ? t("settings:snackbar.wrongPassword")
            : t("settings:snackbar.encryptedFile")
          : e instanceof Error ? e.message : t("settings:snackbar.loadFailed");
        showSnackbar(text, "error");
      }
    } finally {
      setSyncing(null);
      setDialogPassphrase("");
    }
  }, [showSnackbar, t, navigate]);

  const connectDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setDriveSyncing("connect");
    try {
      const { token, expiresIn } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(token, expiresIn);
      setDriveToken(token);
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.connectFailed"), "error");
    } finally {
      setDriveSyncing(null);
    }
  }, [showSnackbar, t]);

  const saveDrive = useCallback(async (passphrase: string) => {
    if (!driveToken) return;
    setDialog(null);
    setDriveSyncing("save");
    try {
      const data = await exportAll();
      await saveBackupToDrive(driveToken, data, passphrase);
      void setSetting("lastLocalSavedAt", Date.now());
      showSnackbar(t("settings:snackbar.savedToDrive"), "ok");
    } catch (e) {
      if (e instanceof DriveAuthError) { setDriveToken(null); void clearDriveToken(); }
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setDriveSyncing(null);
      setDialogPassphrase("");
    }
  }, [driveToken, showSnackbar, t]);

  const loadDrive = useCallback(async (passphrase: string) => {
    if (!driveToken) return;
    setDialog(null);
    setDriveSyncing("load");
    try {
      const data = await loadBackupFromDrive(driveToken, passphrase);
      const [localTxs, localSavedAt] = await Promise.all([
        getAllTransactions(),
        getSetting("lastLocalSavedAt"),
      ]);
      const raw = data as { transactions?: unknown[]; exportedAt?: number };
      const fileCount = Array.isArray(raw.transactions) ? raw.transactions.length : 0;
      setRestorePreview({ data, fileCount, localCount: localTxs.length, remoteSavedAt: raw.exportedAt ?? null, localSavedAt });
    } catch (e) {
      if (e instanceof DriveAuthError) { setDriveToken(null); void clearDriveToken(); }
      const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
      const text = isDecryptErr
        ? passphrase
          ? t("settings:snackbar.wrongPassword")
          : t("settings:snackbar.encryptedFile")
        : e instanceof Error ? e.message : t("settings:snackbar.loadFailed");
      showSnackbar(text, "error");
    } finally {
      setDriveSyncing(null);
      setDialogPassphrase("");
    }
  }, [driveToken, showSnackbar, t]);

  const confirmDriveRestore = useCallback(async () => {
    if (!restorePreview) return;
    const { data } = restorePreview;
    setRestorePreview(null);
    setDriveSyncing("load");
    try {
      await importAll(data);
      showSnackbar(t("settings:snackbar.driveRestoreSuccess"), "ok");
      navigate("/dashboard", { state: { checkDuplicates: true } });
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.loadFailed"), "error");
    } finally {
      setDriveSyncing(null);
    }
  }, [restorePreview, showSnackbar, t, navigate]);

  const forgetKey = useCallback(async () => {
    await clearKey();
    await clearDriveToken();
    navigate("/onboarding");
  }, [navigate]);

  const wipeAccounts = useCallback(async () => {
    if (!confirm(t("settings:danger.confirmDeleteAccounts"))) return;
    setWipingAccounts(true);
    try {
      await clearTransactions();
      await clearAccounts();
      await clearDismissedPairs();
      showSnackbar(t("settings:snackbar.accountsDeleted"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.deleteFailed"), "error");
    } finally {
      setWipingAccounts(false);
    }
  }, [showSnackbar, t]);

  const wipeTransactions = useCallback(async () => {
    if (!confirm(t("settings:danger.confirmDeleteTransactions"))) return;
    setWiping(true);
    try {
      await clearTransactions();
      await clearDismissedPairs();
      showSnackbar(t("settings:snackbar.txDeleted"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.deleteFailed"), "error");
    } finally {
      setWiping(false);
    }
  }, [showSnackbar, t]);

  const wipeAll = useCallback(async () => {
    setWipeAllDialog(false);
    setWipingAll(true);
    try {
      await clearTransactions();
      await clearAccounts();
      await clearKey();
      await clearDriveToken();
      await clearDismissedPairs();
      navigate("/onboarding");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.deleteFailed"), "error");
      setWipingAll(false);
    }
  }, [navigate, showSnackbar, t]);

  if (isDemo === null || isDemo) return null;

  const dialogTitle =
    dialog === "save"
      ? t("settings:backup.dialogSave")
      : dialog === "load"
        ? t("settings:backup.dialogLoad")
        : dialog === "drive-save"
          ? t("settings:backup.dialogDriveSave")
          : t("settings:backup.dialogDriveLoad");

  const dialogHint =
    dialog === "save" || dialog === "drive-save"
      ? t("settings:backup.dialogSaveHint")
      : t("settings:backup.dialogLoadHint");

  const dialogAction =
    dialog === "save" || dialog === "drive-save"
      ? t("settings:backup.dialogActionSave")
      : t("settings:backup.dialogActionLoad");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-text mb-6">{t("settings:title")}</h1>

      <Card id="pem" className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#pem" ? "ring-2 ring-accent" : ""} ${!hasKey ? "border-accent/30 bg-accent/5" : ""}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">{t("settings:signingKey.title")}</h2>
            {hasKey && (
              <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
                {t("settings:signingKey.imported")}
              </span>
            )}
          </div>
          {hasKey && (
            <button
              className="inline-flex items-center gap-1 text-xs text-negative/70 hover:text-negative transition-colors"
              onClick={forgetKey}
            >
              <TrashIcon size={12} />
              {t("settings:signingKey.removeKey")}
            </button>
          )}
        </div>

        {hasKey ? (
          <div className="space-y-3 mt-4">
            <div>
              <Input
                label={t("settings:appId.label")}
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveAppIdFn(); }}
                placeholder={t("settings:appId.placeholder")}
                className="w-full font-mono"
              />
            </div>
            <Button loading={savingAppId} onClick={saveAppIdFn} disabled={!appId.trim() || appId.trim() === savedAppId.current}>
              {t("settings:appId.update")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              <Trans
                i18nKey="settings:signingKey.noKey"
                components={{ pem: <span className="mono" /> }}
              />
            </p>
            {!pemConfirming ? (
              <>
                <button
                  className="text-xs text-accent hover:underline"
                  onClick={() => setShowGuide((v) => !v)}
                >
                  {showGuide ? t("settings:signingKey.guideHide") : t("settings:signingKey.guideShow")}
                </button>
                {showGuide && (
                  <div className="border border-border rounded-xl p-4 mt-1">
                    <BankSetupGuide />
                  </div>
                )}
                <PemImporter
                  onImported={(key, id) => {
                    pendingPemKey.current = key;
                    setPemAppId(id);
                    setPemConfirming(true);
                  }}
                />
              </>
            ) : (
              <div className="space-y-3">
                <Input
                  label={t("settings:appId.label")}
                  value={pemAppId}
                  onChange={(e) => setPemAppId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void confirmPemKey(); }}
                  className="font-mono"
                  autoFocus
                />
                <Button onClick={() => void confirmPemKey()} disabled={!pemAppId.trim()}>
                  {t("settings:signingKey.saveKey")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:proxy.title")}</h2>
        <p className="text-xs text-muted mb-3">
          {t("settings:proxy.description")}
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
            <span className="text-xs text-text">{t("settings:proxy.lommin")}</span>
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
            <span className="text-xs text-text">{t("settings:proxy.custom")}</span>
          </label>
        </div>

        <div className="mb-4 border border-warning/20 bg-warning/5 rounded-lg p-3">
          <p className="text-xs text-muted leading-relaxed">
            <span className="text-text/80 font-medium">OBS! </span>
            {t("settings:proxy.warning")}
          </p>
        </div>

        {proxyMode === "custom" && (
          <div>
            <Input
              label={t("settings:proxy.urlLabel")}
              value={customProxyUrl}
              onChange={(e) => setCustomProxyUrl(e.target.value)}
              placeholder={t("settings:proxy.urlPlaceholder")}
              className="mb-2"
            />
            <Button loading={saving} onClick={saveProxy}>
              {t("common:actions.save")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:sync.title")}</h2>
        <p className="text-xs text-muted mb-3">{t("settings:sync.description")}</p>
        <div className="flex gap-2">
          <Input
            label={t("settings:sync.lookbackLabel")}
            type="number"
            min={1}
            max={3650}
            value={lookbackDays}
            onChange={(e) => setLookbackDays(e.target.value)}
            className="flex-1"
          />
          <div className="self-end">
            <Button loading={savingLookback} onClick={saveLookback}>
              {t("common:actions.save")}
            </Button>
          </div>
        </div>
      </Card>

      <Card id="backup" className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#backup" ? "ring-2 ring-accent" : ""}`}>
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:backup.title")}</h2>
        <p className="text-xs text-muted mb-3">{t("settings:backup.description")}</p>

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
              <span className="text-xs text-text">{t("settings:backup.methodDrive")}</span>
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
              <span className="text-xs text-text">{t("settings:backup.methodFile")}</span>
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
              <span className="text-xs text-text">{t("settings:backup.usePassword")}</span>
            </label>
          )}

          {backupMethod === "drive" ? (
            <div>
              {!GOOGLE_CLIENT_ID ? (
                <p className="text-xs text-muted">
                  {t("settings:backup.driveNotConfigured")}{" "}
                  <span className="mono text-text/70">VITE_GOOGLE_CLIENT_ID</span>
                </p>
              ) : !driveToken ? (
                <Button loading={driveSyncing === "connect"} onClick={connectDrive}>
                  {t("settings:backup.connectDrive")}
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
                      {t("settings:backup.autoSave")}
                      {usePassphrase && (
                        <span className="block text-muted mt-0.5">
                          {t("settings:backup.notAvailableWithPassword")}
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
                      {t("settings:backup.saveToDrive")}
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 justify-center"
                      loading={driveSyncing === "load"}
                      disabled={!!driveSyncing}
                      onClick={() => usePassphrase ? openDialog("drive-load") : void loadDrive("")}
                    >
                      <UploadIcon size={13} />
                      {t("settings:backup.loadFromDrive")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!driveSyncing}
                      onClick={() => { setDriveToken(null); void clearDriveToken(); }}
                    >
                      {t("common:actions.disconnect")}
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
                  {t("settings:backup.saveFile")}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-center"
                  loading={syncing === "load"}
                  disabled={!!syncing}
                  onClick={() => usePassphrase ? openDialog("load") : void loadFile("")}
                >
                  <UploadIcon size={13} />
                  {t("settings:backup.loadFile")}
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
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:spiir.title")}</h2>
        <SpiirImportPanel onSuccess={() => navigate("/dashboard", { state: { checkDuplicates: true } })} />
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

      <Card id="import" className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:ownImport.title")}</h2>
        <p className="text-xs text-muted">{t("settings:ownImport.comingSoon")}</p>
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
            <h3 className="text-sm font-semibold text-text mb-1">{dialogTitle}</h3>
            <p className="text-xs text-muted mb-4">{dialogHint}</p>
            <Input
              label={t("common:dialog.passwordLabel")}
              type="password"
              placeholder={
                dialog === "save" || dialog === "drive-save"
                  ? t("common:dialog.passwordPlaceholder")
                  : t("common:dialog.passwordPlaceholderRequired")
              }
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
                {t("common:actions.cancel")}
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
                {dialogAction}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="p-5 border-negative/10">
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:danger.title")}</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="danger" loading={wiping} onClick={wipeTransactions}>
            {t("settings:danger.deleteTransactions")}
          </Button>
          <Button variant="danger" loading={wipingAccounts} onClick={wipeAccounts}>
            {t("settings:danger.deleteAccounts")}
          </Button>
          <Button variant="danger" loading={wipingAll} onClick={() => setWipeAllDialog(true)}>
            {t("settings:danger.deleteAll")}
          </Button>
        </div>
      </Card>

      {restorePreview && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setRestorePreview(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-text mb-3">{t("settings:backup.restorePreviewTitle")}</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-muted">{t("settings:backup.restorePreviewLocalLabel")}</span>
                <span className="font-medium text-text">
                  {restorePreview.localSavedAt
                    ? new Date(restorePreview.localSavedAt).toLocaleString("nb-NO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : t("settings:backup.restorePreviewNever")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted">{t("settings:backup.restorePreviewRemoteLabel")}</span>
                <span className="font-medium text-text">
                  {restorePreview.remoteSavedAt
                    ? new Date(restorePreview.remoteSavedAt).toLocaleString("nb-NO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{t("settings:backup.restorePreviewFileCount")}</span>
                  <span className="font-medium text-text">{restorePreview.fileCount}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted">{t("settings:backup.restorePreviewLocalCount")}</span>
                  <span className="font-medium text-text">{restorePreview.localCount}</span>
                </div>
              </div>
            </div>
            {restorePreview.fileCount > restorePreview.localCount && (
              <div className="border border-warning/20 bg-warning/5 rounded-lg p-3 mb-4">
                <p className="text-xs text-warning leading-relaxed">
                  {t("settings:backup.restorePreviewWarning")}
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setRestorePreview(null)}>
                {t("common:actions.cancel")}
              </Button>
              <Button onClick={() => void confirmDriveRestore()}>
                {t("settings:backup.restorePreviewProceed")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {wipeAllDialog && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setWipeAllDialog(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-text mb-2">{t("settings:danger.wipeAllTitle")}</h3>
            <p className="text-xs text-muted mb-6">{t("settings:danger.wipeAllBody")}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setWipeAllDialog(false)}>
                {t("common:actions.cancel")}
              </Button>
              <Button variant="danger" onClick={wipeAll}>
                {t("settings:danger.deleteAll")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
