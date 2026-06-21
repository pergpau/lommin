import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { DownloadIcon, UploadIcon } from "../ui/icons";
import Input from "../ui/Input";
import { useSnackbar } from "../ui/Snackbar";
import { loadEncryptedFile, saveEncryptedFile } from "../../lib/cryptoFile";
import {
  DriveAuthError,
  loadBackupFromDrive,
  saveBackupToDrive,
  signInWithGoogle,
} from "../../lib/googleDrive";
import {
  clearDriveToken,
  getDriveToken,
  getSetting,
  hasSetting,
  persistDriveToken,
  setSetting,
} from "../../lib/settings";
import { exportAll, getAllTransactions, importAll } from "../../lib/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function BackupSection({ highlightedHash }: { highlightedHash: string | null }) {
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [backupMethod, setBackupMethod] = useState<"drive" | "file" | null>(null);
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
  const [syncing, setSyncing] = useState<"save" | "load" | null>(null);

  useEffect(() => {
    Promise.all([
      getSetting("usePassphrase"),
      getSetting("backupMethod"),
      getSetting("driveAutosave"),
      hasSetting("backupMethod"),
      getDriveToken(),
    ]).then(([pp, method, autosave, hasMethod, stored]) => {
      setUsePassphrase(pp);
      setBackupMethod(hasMethod ? method : null);
      setDriveAutosave(autosave);
      if (stored) setDriveToken(stored.token);
    });
  }, []);

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
    <>
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
          ) : backupMethod === "file" ? (
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
          ) : null}
        </div>
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
    </>
  );
}
