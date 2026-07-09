import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { DownloadIcon, UploadIcon } from "../ui/icons";
import Modal from "../ui/Modal";
import PassphraseDialog from "../ui/PassphraseDialog";
import Spinner from "../ui/Spinner";
import { useSnackbar } from "../ui/Snackbar";
import {
  applyRestore,
  BackupError,
  loadBackup,
  type RestorePlan,
  saveBackup,
} from "../../lib/backup";
import { signInWithGoogle } from "../../lib/googleDrive";
import {
  clearDriveAccountEmail,
  clearDriveToken,
  getDriveToken,
  getSetting,
  hasSetting,
  persistDriveToken,
  setDriveAccountEmail,
  setSetting,
} from "../../lib/settings";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function BackupSection({ highlightedHash }: { highlightedHash: string | null }) {
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [backupMethod, setBackupMethod] = useState<"drive" | "file" | null>(null);
  const [driveAutosave, setDriveAutosave] = useState(true);
  const [dialog, setDialog] = useState<"save" | "load" | "drive-save" | "drive-load" | null>(null);
  const [restorePreview, setRestorePreview] = useState<
    { loading: true } | { loading: false; plan: RestorePlan } | null
  >(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveSyncing, setDriveSyncing] = useState<"connect" | "save" | "load" | null>(null);
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

    const handleTokenUpdated = () => {
      void getDriveToken().then((stored) => setDriveToken(stored?.token ?? null));
    };
    window.addEventListener("lommin:drive-token-updated", handleTokenUpdated);
    return () => window.removeEventListener("lommin:drive-token-updated", handleTokenUpdated);
  }, []);

  const changeBackupMethod = useCallback((method: "drive" | "file") => {
    setBackupMethod(method);
    void setSetting("backupMethod", method);
  }, []);

  const backupErrorText = useCallback(
    (e: unknown, fallback: string): string => {
      const kind = e instanceof BackupError ? e.kind : "unknown";
      if (kind === "wrong-passphrase") return t("settings:snackbar.wrongPassword");
      if (kind === "passphrase-required") return t("settings:snackbar.encryptedFile");
      return e instanceof Error && e.message ? e.message : fallback;
    },
    [t],
  );

  const handleSave = useCallback(
    async (passphrase: string) => {
      const isDrive = backupMethod === "drive";
      setDialog(null);
      (isDrive ? setDriveSyncing : setSyncing)("save");
      try {
        await saveBackup(passphrase);
        showSnackbar(
          t(isDrive ? "settings:snackbar.savedToDrive" : "settings:snackbar.savedToFile"),
          "ok",
        );
      } catch (e) {
        const kind = e instanceof BackupError ? e.kind : "unknown";
        if (kind === "drive-auth") setDriveToken(null);
        if (kind !== "cancelled")
          showSnackbar(backupErrorText(e, t("settings:snackbar.saveFailed")), "error");
      } finally {
        (isDrive ? setDriveSyncing : setSyncing)(null);
      }
    },
    [backupMethod, showSnackbar, t, backupErrorText],
  );

  const loadFile = useCallback(
    async (passphrase: string) => {
      setDialog(null);
      setSyncing("load");
      try {
        const plan = await loadBackup(passphrase, { source: "file" });
        await applyRestore(plan);
        showSnackbar(t("settings:snackbar.restoreSuccess"), "ok");
        navigate("/dashboard", { state: { checkDuplicates: true } });
      } catch (e) {
        if (!(e instanceof BackupError && e.kind === "cancelled"))
          showSnackbar(backupErrorText(e, t("settings:snackbar.loadFailed")), "error");
      } finally {
        setSyncing(null);
      }
    },
    [showSnackbar, t, navigate, backupErrorText],
  );

  const connectDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setDriveSyncing("connect");
    try {
      const { token, expiresIn, email } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(token, expiresIn);
      if (email) await setDriveAccountEmail(email);
      setDriveToken(token);
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.connectFailed"), "error");
    } finally {
      setDriveSyncing(null);
    }
  }, [showSnackbar, t]);

  const loadDrive = useCallback(
    async (passphrase: string) => {
      if (!driveToken) return;
      setDialog(null);
      setRestorePreview({ loading: true });
      try {
        const plan = await loadBackup(passphrase, { source: "drive" });
        setRestorePreview({ loading: false, plan });
      } catch (e) {
        setRestorePreview(null);
        if (e instanceof BackupError && e.kind === "drive-auth") setDriveToken(null);
        showSnackbar(backupErrorText(e, t("settings:snackbar.loadFailed")), "error");
      }
    },
    [driveToken, showSnackbar, t, backupErrorText],
  );

  const confirmDriveRestore = useCallback(async () => {
    if (!restorePreview || restorePreview.loading) return;
    const { plan } = restorePreview;
    setRestorePreview(null);
    setDriveSyncing("load");
    showSnackbar(t("common:sync.syncing"), "info", null);
    try {
      await applyRestore(plan, { mode: "overwrite" });
      showSnackbar(t("settings:snackbar.driveRestoreSuccess"), "ok");
      navigate("/dashboard", { state: { checkDuplicates: true } });
    } catch (e) {
      showSnackbar(backupErrorText(e, t("settings:snackbar.loadFailed")), "error");
    } finally {
      setDriveSyncing(null);
    }
  }, [restorePreview, showSnackbar, t, navigate, backupErrorText]);

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
      <Card
        id="backup"
        className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#backup" ? "ring-2 ring-accent" : ""}`}
      >
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
                onChange={(e) => {
                  setUsePassphrase(e.target.checked);
                  void setSetting("usePassphrase", e.target.checked);
                }}
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
                  <label
                    className={`flex items-start gap-2 cursor-pointer${usePassphrase ? " opacity-50" : ""}`}
                  >
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
                      disabled={!!driveSyncing || !!restorePreview}
                      onClick={() =>
                        usePassphrase ? setDialog("drive-save") : void handleSave("")
                      }
                    >
                      <DownloadIcon size={13} />
                      {t("settings:backup.saveToDrive")}
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 justify-center"
                      loading={driveSyncing === "load"}
                      disabled={!!driveSyncing || !!restorePreview}
                      onClick={() => (usePassphrase ? setDialog("drive-load") : void loadDrive(""))}
                    >
                      <UploadIcon size={13} />
                      {t("settings:backup.loadFromDrive")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!driveSyncing || !!restorePreview}
                      onClick={() => {
                        setDriveToken(null);
                        void clearDriveToken();
                        void clearDriveAccountEmail();
                      }}
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
                  onClick={() => (usePassphrase ? setDialog("save") : void handleSave(""))}
                >
                  <DownloadIcon size={13} />
                  {t("settings:backup.saveFile")}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-center"
                  loading={syncing === "load"}
                  disabled={!!syncing}
                  onClick={() => (usePassphrase ? setDialog("load") : void loadFile(""))}
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
        <PassphraseDialog
          title={dialogTitle}
          hint={dialogHint}
          actionLabel={dialogAction}
          placeholder={
            dialog === "save" || dialog === "drive-save"
              ? undefined
              : t("common:dialog.passwordPlaceholderRequired")
          }
          onSubmit={(passphrase) => {
            if (dialog === "save" || dialog === "drive-save") void handleSave(passphrase);
            else if (dialog === "load") void loadFile(passphrase);
            else void loadDrive(passphrase);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {restorePreview && (
        <Modal
          onClose={() => setRestorePreview(null)}
          closeDisabled={restorePreview.loading}
          title={t("settings:backup.restorePreviewTitle")}
        >
          {restorePreview.loading ? (
            <div className="flex justify-center py-6">
              <Spinner size={24} />
            </div>
          ) : (
            <>
              {(() => {
                const { plan } = restorePreview;
                const localNewer = plan.freshness === "local-newer" || plan.freshness === "same";
                const remoteNewer = plan.freshness === "backup-newer" || plan.freshness === "same";
                const fmt = (ts: number) =>
                  new Date(ts).toLocaleString("nb-NO", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                return (
                  <div className="space-y-2 mt-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">
                        {t("settings:backup.restorePreviewLocalLabel")}
                      </span>
                      {plan.localSavedAt ? (
                        <span
                          className={`font-medium ${localNewer ? "text-green-500" : remoteNewer ? "text-red-500" : "text-text"}`}
                        >
                          {fmt(plan.localSavedAt)}
                        </span>
                      ) : (
                        <span className="italic text-muted">
                          {t("settings:backup.restorePreviewNever")}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">
                        {t("settings:backup.restorePreviewRemoteLabel")}
                      </span>
                      {plan.backupSavedAt ? (
                        <span
                          className={`font-medium ${remoteNewer ? "text-green-500" : localNewer ? "text-red-500" : "text-text"}`}
                        >
                          {fmt(plan.backupSavedAt)}
                        </span>
                      ) : (
                        <span className="italic text-muted">
                          {t("settings:backup.restorePreviewNever")}
                        </span>
                      )}
                    </div>
                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">
                          {t("settings:backup.restorePreviewFileCount")}
                        </span>
                        <span className="font-medium text-text">{plan.backupCount}</span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-muted">
                          {t("settings:backup.restorePreviewLocalCount")}
                        </span>
                        <span className="font-medium text-text">{plan.localCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {restorePreview.plan.warnFewerTransactions && (
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
            </>
          )}
        </Modal>
      )}
    </>
  );
}
