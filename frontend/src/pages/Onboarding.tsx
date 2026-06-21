import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import BankSetupGuide from "../components/BankSetupGuide";
import CsvImportPanel from "../components/CsvImport";
import PemImporter from "../components/PemImporter";
import PemSafetyAccordion from "../components/PemSafetyAccordion";
import SpiirImportPanel from "../components/SpiirImport";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  FileUpIcon,
  PlusIcon,
  ShieldIcon,
  UploadIcon,
} from "../components/ui/icons";
import Input from "../components/ui/Input";
import { loadEncryptedFile } from "../lib/cryptoFile";
import { seedDemoData } from "../lib/demoData";
import { DriveAuthError, loadBackupFromDrive, signInWithGoogle } from "../lib/googleDrive";
import { loadKey, saveKey } from "../lib/keystore";
import { getSetting, HOSTED_PROXY_URL, persistDriveToken, setSetting } from "../lib/settings";
import { getAccounts, importAll } from "../lib/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type OnboardingStep =
  | { kind: "intro" }
  | { kind: "pick" }
  | { kind: "bank-explain" }
  | { kind: "bank-proxy" }
  | { kind: "bank-pem" }
  | { kind: "bank-confirm"; pendingKey: CryptoKey; appId: string }
  | { kind: "import-pick" }
  | { kind: "import-spiir" }
  | { kind: "import-own" }
  | { kind: "restore" }
  | { kind: "demo" };

type GoTo = (step: OnboardingStep) => void;

function PickCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:border-accent/40 hover:bg-surface-2/50 hover:shadow-sm transition-all w-full"
    >
      <div className="mb-3 text-accent">{icon}</div>
      <div className="text-sm font-medium text-text mb-1">{title}</div>
      <div className="text-xs text-muted leading-relaxed">{description}</div>
    </button>
  );
}

// --- Step components ---

function StepIntro({ onNext }: { onNext: GoTo }) {
  const { t } = useTranslation("onboarding");
  return (
    <div>
      <div className="mono text-accent text-sm mb-4 tracking-widest uppercase">{t("intro.label")}</div>
      <h1 className="text-2xl font-semibold text-text tracking-tight leading-tight mb-4">
        {t("intro.title")}
      </h1>
      <p className="text-muted text-sm leading-relaxed mb-2">{t("intro.body1")}</p>
      <p className="text-muted text-sm leading-relaxed mb-10">{t("intro.body2")}</p>
      <Button className="w-full justify-center" onClick={() => onNext({ kind: "pick" })}>
        {t("intro.start")}
      </Button>
    </div>
  );
}

function StepPick({ onNext }: { onNext: GoTo }) {
  const { t } = useTranslation("onboarding");
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("pick.title")}</h2>
      <p className="text-sm text-muted mb-6">{t("pick.subtitle")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PickCard
          icon={<ShieldIcon size={20} />}
          title={t("pick.bank.title")}
          description={t("pick.bank.description")}
          onClick={() => onNext({ kind: "bank-explain" })}
        />
        <PickCard
          icon={<UploadIcon size={20} />}
          title={t("pick.import.title")}
          description={t("pick.import.description")}
          onClick={() => onNext({ kind: "import-pick" })}
        />
        <PickCard
          icon={<DownloadIcon size={20} />}
          title={t("pick.restore.title")}
          description={t("pick.restore.description")}
          onClick={() => onNext({ kind: "restore" })}
        />
        <PickCard
          icon={<PlusIcon size={20} />}
          title={t("pick.demo.title")}
          description={t("pick.demo.description")}
          onClick={() => onNext({ kind: "demo" })}
        />
      </div>
    </div>
  );
}

function StepBankExplain({ onNext }: { onNext: GoTo }) {
  const { t } = useTranslation("onboarding");
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("bankExplain.title")}</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">{t("bankExplain.body")}</p>
      <div className="mb-8">
        <BankSetupGuide />
      </div>
      <Button className="w-full justify-center" onClick={() => onNext({ kind: "bank-proxy" })}>
        {t("bankExplain.next")}
      </Button>
    </div>
  );
}

function StepBankProxy({ onNext }: { onNext: GoTo }) {
  const { t } = useTranslation("onboarding");
  const [proxyMode, setProxyMode] = useState<"lommin" | "custom">("lommin");
  const [customUrl, setCustomUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSetting("proxyUrl").then((url) => {
      if (url === HOSTED_PROXY_URL) {
        setProxyMode("lommin");
      } else {
        setProxyMode("custom");
        setCustomUrl(url);
      }
    });
  }, []);

  const saveAndNext = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const url = proxyMode === "lommin" ? HOSTED_PROXY_URL : customUrl.trim();
      if (url) await setSetting("proxyUrl", url);
      onNext({ kind: "bank-pem" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("bankProxy.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [proxyMode, customUrl, onNext, t]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("bankProxy.title")}</h2>
      <p className="text-sm text-muted mb-4 leading-relaxed">{t("bankProxy.body")}</p>

      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="proxyMode"
            value="lommin"
            checked={proxyMode === "lommin"}
            onChange={() => setProxyMode("lommin")}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-sm text-text">{t("bankProxy.lommin")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="proxyMode"
            value="custom"
            checked={proxyMode === "custom"}
            onChange={() => setProxyMode("custom")}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-sm text-text">{t("bankProxy.custom")}</span>
        </label>
      </div>

      {proxyMode === "custom" && (
        <Input
          label={t("bankProxy.urlLabel")}
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveAndNext();
          }}
          placeholder={t("bankProxy.urlPlaceholder")}
          className="mb-4"
        />
      )}

      {error && <Alert type="error" message={error} className="mb-4" />}
      <div className="flex gap-2">
        <Button className="flex-1 justify-center" loading={saving} onClick={saveAndNext}>
          {t("bankProxy.saveAndNext")}
        </Button>
      </div>
    </div>
  );
}

function StepBankPem({ onNext }: { onNext: GoTo }) {
  const { t } = useTranslation("onboarding");
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("bankPem.title")}</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        <Trans
          i18nKey="onboarding:bankPem.body"
          components={{ pem: <span className="mono" /> }}
        />
      </p>
      <div className="mb-4">
        <PemSafetyAccordion />
      </div>
      <PemImporter
        onImported={(key, appId) => onNext({ kind: "bank-confirm", pendingKey: key, appId })}
      />
    </div>
  );
}

function StepBankConfirm({
  step,
  navigate,
}: {
  step: { pendingKey: CryptoKey; appId: string };
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { t } = useTranslation("onboarding");
  const [appId, setAppId] = useState(step.appId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const confirm = useCallback(async () => {
    if (!appId.trim()) return;
    setConfirming(true);
    setError("");
    try {
      await saveKey(step.pendingKey, appId.trim());
      setDone(true);
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("bankConfirm.saveFailed"));
    } finally {
      setConfirming(false);
    }
  }, [appId, step.pendingKey, navigate, t]);

  if (done) {
    return (
      <div className="border border-positive/20 bg-positive/5 rounded-xl p-6 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center flex-shrink-0">
            <CheckIcon size={16} className="text-positive" />
          </div>
          <div>
            <div className="text-sm font-medium text-text">{t("bankConfirm.keyImported")}</div>
            <div className="mono text-xs text-muted mt-1 break-all">{appId}</div>
            <div className="text-xs text-muted mt-2">{t("bankConfirm.sendingToDash")}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("bankConfirm.title")}</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        <Trans
          i18nKey="onboarding:bankConfirm.body"
          components={{
            link: (
              <a
                href="https://enablebanking.com/sign-in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              />
            ),
          }}
        />
      </p>
      <Input
        label={t("bankConfirm.appIdLabel")}
        value={appId}
        onChange={(e) => setAppId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void confirm();
        }}
        className="font-mono mb-4"
        autoFocus
      />
      {error && <Alert type="error" message={error} className="mb-4" />}
      <Button
        className="w-full justify-center"
        loading={confirming}
        onClick={confirm}
        disabled={!appId.trim()}
      >
        {t("bankConfirm.saveAndNext")}
      </Button>
    </div>
  );
}

function StepImportPick({ onNext }: { onNext: GoTo }) {
  const { t } = useTranslation("onboarding");
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("importPick.title")}</h2>
      <p className="text-sm text-muted mb-6">{t("importPick.subtitle")}</p>
      <div className="space-y-3">
        <PickCard
          icon={<UploadIcon size={20} />}
          title={t("importPick.fromSpiir.title")}
          description={t("importPick.fromSpiir.description")}
          onClick={() => onNext({ kind: "import-spiir" })}
        />
        <PickCard
          icon={<FileUpIcon size={20} />}
          title={t("importPick.fromOwn.title")}
          description={t("importPick.fromOwn.description")}
          onClick={() => onNext({ kind: "import-own" })}
        />
      </div>
    </div>
  );
}

function StepImportOwn() {
  const { t } = useTranslation("onboarding");
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("importOwn.title")}</h2>
      <CsvImportPanel />
    </div>
  );
}

function StepRestore({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { t } = useTranslation("onboarding");
  const [passphrase, setPassphrase] = useState("");
  const [fileState, setFileState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fileMsg, setFileMsg] = useState("");

  const restore = useCallback(async () => {
    setFileState("loading");
    setFileMsg("");
    try {
      const { inserted } = await importAll(await loadEncryptedFile(passphrase));
      await setSetting("backupMethod", "file");
      setFileState("done");
      setFileMsg(t("restore.restored", { count: inserted }));
      setTimeout(() => navigate("/dashboard", { state: { checkDuplicates: true } }), 1000);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setFileState("idle");
        return;
      }
      const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
      setFileState("error");
      setFileMsg(
        isDecryptErr
          ? passphrase
            ? t("restore.errors.wrongPassword")
            : t("restore.errors.encrypted")
          : e instanceof Error
            ? e.message
            : t("restore.errors.restoreFailed"),
      );
    }
  }, [passphrase, navigate, t]);

  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [drivePassphrase, setDrivePassphrase] = useState("");
  const [driveState, setDriveState] = useState<
    "idle" | "connecting" | "loading" | "done" | "error"
  >("idle");
  const [driveMsg, setDriveMsg] = useState("");

  const connectDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setDriveState("connecting");
    setDriveMsg("");
    try {
      const { token: tok, expiresIn } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(tok, expiresIn);
      setDriveToken(tok);
      setDriveState("idle");
    } catch (e) {
      setDriveState("error");
      setDriveMsg(e instanceof Error ? e.message : t("restore.errors.connectFailed"));
    }
  }, [t]);

  const loadDrive = useCallback(async () => {
    if (!driveToken) return;
    setDriveState("loading");
    setDriveMsg("");
    try {
      const { inserted } = await importAll(
        await loadBackupFromDrive(driveToken, drivePassphrase),
      );
      await setSetting("backupMethod", "drive");
      setDriveState("done");
      setDriveMsg(t("restore.restored", { count: inserted }));
      setTimeout(() => navigate("/dashboard", { state: { checkDuplicates: true } }), 1000);
    } catch (e) {
      if (e instanceof DriveAuthError) setDriveToken(null);
      const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
      setDriveState("error");
      setDriveMsg(
        isDecryptErr
          ? drivePassphrase
            ? t("restore.errors.wrongPassword")
            : t("restore.errors.encrypted")
          : e instanceof Error
            ? e.message
            : t("restore.errors.loadDriveFailed"),
      );
    }
  }, [driveToken, drivePassphrase, navigate, t]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("restore.title")}</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">{t("restore.body")}</p>

      <div className="space-y-4">
        <div className="border border-border rounded-xl p-4">
          <div className="text-sm font-medium text-text mb-1">{t("restore.fromFile.title")}</div>
          <p className="text-xs text-muted mb-3">
            <Trans
              i18nKey="onboarding:restore.fromFile.body"
              components={{ enc: <span className="mono" /> }}
            />
          </p>
          <Input
            label={t("restore.fromFile.passwordLabel")}
            type="password"
            placeholder={t("restore.fromFile.passwordPlaceholder")}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void restore();
            }}
            className="mb-3"
          />
          <Button
            className="w-full justify-center"
            loading={fileState === "loading"}
            onClick={restore}
          >
            {fileState !== "loading" && <UploadIcon size={13} />}
            {t("restore.fromFile.button")}
          </Button>
          {fileMsg && (
            <Alert
              type={fileState === "error" ? "error" : "ok"}
              message={fileMsg}
              className="mt-3"
            />
          )}
        </div>

        {GOOGLE_CLIENT_ID && (
          <div className="border border-border rounded-xl p-4">
            <div className="text-sm font-medium text-text mb-1">{t("restore.fromDrive.title")}</div>
            <p className="text-xs text-muted mb-3">{t("restore.fromDrive.body")}</p>
            {!driveToken ? (
              <Button
                className="w-full justify-center"
                loading={driveState === "connecting"}
                onClick={connectDrive}
              >
                {t("restore.fromDrive.connectButton")}
              </Button>
            ) : (
              <>
                <Input
                  label={t("restore.fromDrive.passwordLabel")}
                  type="password"
                  placeholder={t("restore.fromDrive.passwordPlaceholder")}
                  value={drivePassphrase}
                  onChange={(e) => setDrivePassphrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadDrive();
                  }}
                  className="mb-3"
                />
                <Button
                  className="w-full justify-center"
                  loading={driveState === "loading"}
                  onClick={loadDrive}
                >
                  {driveState !== "loading" && <UploadIcon size={13} />}
                  {t("restore.fromDrive.loadButton")}
                </Button>
              </>
            )}
            {driveMsg && (
              <Alert
                type={driveState === "error" ? "error" : "ok"}
                message={driveMsg}
                className="mt-3"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepDemo({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { t } = useTranslation("onboarding");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startDemo = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [key, accounts] = await Promise.all([loadKey(), getAccounts()]);
      if (key || accounts.length > 0) {
        setError(t("demo.hasDataError"));
        setLoading(false);
        return;
      }
      await seedDemoData();
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("demo.startFailed"));
      setLoading(false);
    }
  }, [navigate, t]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">{t("demo.title")}</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">{t("demo.body")}</p>
      <div className="card p-5 mb-6">
        <div className="text-xs text-muted mb-2 font-medium">{t("demo.includes")}</div>
        <ul className="text-xs text-muted space-y-1">
          <li>{t("demo.bullet1")}</li>
          <li>{t("demo.bullet2")}</li>
          <li>{t("demo.bullet3")}</li>
        </ul>
      </div>
      {error && <Alert type="error" message={error} className="mb-4" />}
      <Button className="w-full justify-center" loading={loading} onClick={startDemo}>
        {t("demo.startButton")}
      </Button>
    </div>
  );
}

// --- Wizard shell ---

export default function Onboarding() {
  const { t } = useTranslation("onboarding");
  const navigate = useNavigate();
  const [history, setHistory] = useState<OnboardingStep[]>([{ kind: "intro" }]);

  useEffect(() => {
    Promise.all([loadKey(), getAccounts()]).then(([key, accounts]) => {
      if (key || accounts.length > 0) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);
  const current = history[history.length - 1];

  const goTo = useCallback((step: OnboardingStep) => {
    setHistory((h) => [...h, step]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  return (
    <div className="min-h-screen bg-bg grid-bg flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-lg animate-slide-up">
        {history.length > 1 && (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6 transition-colors"
          >
            <ArrowLeftIcon size={14} />
            {t("back")}
          </button>
        )}

        {current.kind === "intro" && <StepIntro onNext={goTo} />}
        {current.kind === "pick" && <StepPick onNext={goTo} />}
        {current.kind === "bank-explain" && <StepBankExplain onNext={goTo} />}
        {current.kind === "bank-proxy" && <StepBankProxy onNext={goTo} />}
        {current.kind === "bank-pem" && <StepBankPem onNext={goTo} />}
        {current.kind === "bank-confirm" && (
          <StepBankConfirm step={current} navigate={navigate} />
        )}
        {current.kind === "import-pick" && <StepImportPick onNext={goTo} />}
        {current.kind === "import-spiir" && (
          <div>
            <h2 className="text-xl font-semibold text-text mb-1">{t("importSpiir.title")}</h2>
            <SpiirImportPanel onSuccess={() => navigate("/dashboard", { state: { checkDuplicates: true } })} />
          </div>
        )}
        {current.kind === "import-own" && <StepImportOwn />}
        {current.kind === "restore" && <StepRestore navigate={navigate} />}
        {current.kind === "demo" && <StepDemo navigate={navigate} />}
      </div>
    </div>
  );
}
