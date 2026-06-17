import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BankSetupGuide from "../components/BankSetupGuide";
import PemImporter from "../components/PemImporter";
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
  return (
    <div>
      <div className="mono text-accent text-sm mb-4 tracking-widest uppercase">Lommin</div>
      <h1 className="text-2xl font-semibold text-text tracking-tight leading-tight mb-4">
        Ta kontroll på pengebruken
      </h1>
      <p className="text-muted text-sm leading-relaxed mb-2">
        Lommin kobler seg direkte til bankkontoene og kredittkortene dine og gir deg et klart bilde
        av forbruket ditt — kategorisert og alltid oppdatert.
      </p>
      <p className="text-muted text-sm leading-relaxed mb-10">
        Alle data lagres lokalt på enheten din. Ingenting deles med noen tredjeparter.
      </p>
      <Button className="w-full justify-center" onClick={() => onNext({ kind: "pick" })}>
        Kom i gang
      </Button>
    </div>
  );
}

function StepPick({ onNext }: { onNext: GoTo }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Kom i gang</h2>
      <p className="text-sm text-muted mb-6">Hvordan vil du bruke Lommin?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PickCard
          icon={<ShieldIcon size={20} />}
          title="Koble til bankkontoer"
          description="Synkroniser direkte fra din bank via Enable Banking"
          onClick={() => onNext({ kind: "bank-explain" })}
        />
        <PickCard
          icon={<UploadIcon size={20} />}
          title="Importer"
          description="Historiske data fra Spiir eller egne filer"
          onClick={() => onNext({ kind: "import-pick" })}
        />
        <PickCard
          icon={<DownloadIcon size={20} />}
          title="Gjenopprett"
          description="Fra lokal fil eller Google Drive-sikkerhetskopi"
          onClick={() => onNext({ kind: "restore" })}
        />
        <PickCard
          icon={<PlusIcon size={20} />}
          title="Prøv demo"
          description="Utforsk Lommin med syntetiske testdata — ingen konto nødvendig"
          onClick={() => onNext({ kind: "demo" })}
        />
      </div>
    </div>
  );
}

function StepBankExplain({ onNext }: { onNext: GoTo }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Koble til bankkontoer</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        Lommin bruker Enable Banking for å hente transaksjoner direkte fra dine kontoer eller kort. Du trenger en
        gratis Enable Banking-konto og en signeringsnøkkel.
      </p>
      <div className="mb-8">
        <BankSetupGuide />
      </div>
      <Button className="w-full justify-center" onClick={() => onNext({ kind: "bank-proxy" })}>
        Neste
      </Button>
    </div>
  );
}

function StepBankProxy({ onNext }: { onNext: GoTo }) {
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
      setError(e instanceof Error ? e.message : "Lagring feilet");
    } finally {
      setSaving(false);
    }
  }, [proxyMode, customUrl, onNext]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">CORS-proxy</h2>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        For å bruke Enable Banking må alle API-kall sendes gjennom en proxy. Standardproxyen er hostet av Lommin og kan i
        teorien se transaksjonsdata og tilgangstokens i transitt. For full kontroll kan du
        bruke din egen proxy.
      </p>

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
          <span className="text-sm text-text">Lommin proxy (standard)</span>
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
          <span className="text-sm text-text">Egendefinert</span>
        </label>
      </div>

      {proxyMode === "custom" && (
        <Input
          label="Proxy-URL"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveAndNext();
          }}
          placeholder="https://din-proxy.workers.dev"
          className="mb-4"
        />
      )}

      {error && <Alert type="error" message={error} className="mb-4" />}
      <div className="flex gap-2">
        <Button className="flex-1 justify-center" loading={saving} onClick={saveAndNext}>
          Lagre og fortsett
        </Button>
      </div>
    </div>
  );
}

function StepBankPem({ onNext }: { onNext: GoTo }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Importer signeringsnøkkel</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        Last opp <span className="mono">.pem</span>-filen fra Enable Banking, eller lim inn
        innholdet direkte.
      </p>
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
      setError(e instanceof Error ? e.message : "Klarte ikke å lagre nøkkelen");
    } finally {
      setConfirming(false);
    }
  }, [appId, step.pendingKey, navigate]);

  if (done) {
    return (
      <div className="border border-positive/20 bg-positive/5 rounded-xl p-6 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center flex-shrink-0">
            <CheckIcon size={16} className="text-positive" />
          </div>
          <div>
            <div className="text-sm font-medium text-text">Nøkkel importert</div>
            <div className="mono text-xs text-muted mt-1 break-all">{appId}</div>
            <div className="text-xs text-muted mt-2">Sender deg til dashbordet…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Bekreft App ID</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        App ID-en er hentet fra filnavnet. Sjekk at den stemmer med ID-en i{" "}
        <a
          href="https://enablebanking.com/sign-in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Enable Banking-dashbordet
        </a>
        . På mobil kan filnavnet noen ganger endres automatisk.
      </p>
      <Input
        label="App ID"
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
        Lagre og fortsett
      </Button>
    </div>
  );
}

function StepImportPick({ onNext }: { onNext: GoTo }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Importer data</h2>
      <p className="text-sm text-muted mb-6">Velg kilden for historiske transaksjoner.</p>
      <div className="space-y-3">
        <PickCard
          icon={<UploadIcon size={20} />}
          title="Fra Spiir"
          description="Importer CSV- eller ZIP-eksport fra Spiir"
          onClick={() => onNext({ kind: "import-spiir" })}
        />
        <PickCard
          icon={<FileUpIcon size={20} />}
          title="Fra egne data"
          description="Importer egne CSV-filer og andre formater"
          onClick={() => onNext({ kind: "import-own" })}
        />
      </div>
    </div>
  );
}

function StepImportOwn() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Import fra egne data</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        Importer transaksjoner fra egne CSV-filer og andre kilder.
      </p>
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">Kommer snart</p>
      </div>
    </div>
  );
}

function StepRestore({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [passphrase, setPassphrase] = useState("");
  const [fileState, setFileState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fileMsg, setFileMsg] = useState("");

  const restore = useCallback(async () => {
    setFileState("loading");
    setFileMsg("");
    try {
      const { inserted } = await importAll(await loadEncryptedFile(passphrase));
      setFileState("done");
      setFileMsg(`Gjenopprettet ${inserted} transaksjoner.`);
      setTimeout(() => navigate("/dashboard"), 1000);
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
            ? "Feil passord."
            : "Filen er kryptert med passord."
          : e instanceof Error
            ? e.message
            : "Klarte ikke å gjenopprette sikkerhetskopien",
      );
    }
  }, [passphrase, navigate]);

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
      const { token: t, expiresIn } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(t, expiresIn);
      setDriveToken(t);
      setDriveState("idle");
    } catch (e) {
      setDriveState("error");
      setDriveMsg(e instanceof Error ? e.message : "Tilkobling feilet");
    }
  }, []);

  const loadDrive = useCallback(async () => {
    if (!driveToken) return;
    setDriveState("loading");
    setDriveMsg("");
    try {
      const { inserted } = await importAll(
        await loadBackupFromDrive(driveToken, drivePassphrase),
      );
      setDriveState("done");
      setDriveMsg(`Gjenopprettet ${inserted} transaksjoner.`);
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (e) {
      if (e instanceof DriveAuthError) setDriveToken(null);
      const isDecryptErr = e instanceof DOMException && e.name === "OperationError";
      setDriveState("error");
      setDriveMsg(
        isDecryptErr
          ? drivePassphrase
            ? "Feil passord."
            : "Filen er kryptert med passord."
          : e instanceof Error
            ? e.message
            : "Klarte ikke å laste fra Google Drive",
      );
    }
  }, [driveToken, drivePassphrase, navigate]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Gjenopprett</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        Dekrypter og flett inn kontoer og transaksjoner fra en tidligere sikkerhetskopi.
      </p>

      <div className="space-y-4">
        <div className="border border-border rounded-xl p-4">
          <div className="text-sm font-medium text-text mb-1">Fra lokal fil</div>
          <p className="text-xs text-muted mb-3">
            Dekrypter en <span className="mono">.enc</span>-sikkerhetskopi fra din enhet.
          </p>
          <Input
            label="Passord"
            type="password"
            placeholder="La stå tomt hvis ingen kryptering…"
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
            Velg fil og gjenopprett
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
            <div className="text-sm font-medium text-text mb-1">Fra Google Drive</div>
            <p className="text-xs text-muted mb-3">
              Last ned og dekrypter sikkerhetskopien din fra Google Drive.
            </p>
            {!driveToken ? (
              <Button
                className="w-full justify-center"
                loading={driveState === "connecting"}
                onClick={connectDrive}
              >
                Koble til Google Drive
              </Button>
            ) : (
              <>
                <Input
                  label="Passord"
                  type="password"
                  placeholder="La stå tomt hvis ingen kryptering…"
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
                  Last fra Drive
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startDemo = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [key, accounts] = await Promise.all([loadKey(), getAccounts()]);
      if (key || accounts.length > 0) {
        setError("Du har allerede data. Slett eksisterende data i innstillingene før du starter demo.");
        setLoading(false);
        return;
      }
      await seedDemoData();
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Klarte ikke å starte demo");
      setLoading(false);
    }
  }, [navigate]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Prøv demo</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        Utforsk alle funksjoner i Lommin med syntetiske testdata. Ingen ekte data lastes opp eller
        lagres eksternt. Du kan avslutte demoen når som helst.
      </p>
      <div className="card p-5 mb-6">
        <div className="text-xs text-muted mb-2 font-medium">Inkluderer:</div>
        <ul className="text-xs text-muted space-y-1">
          <li>· 2 kontoer (brukskonto og kredittkort)</li>
          <li>· ~35 transaksjoner over 3 måneder med kategorier</li>
          <li>· Eksempel på budsjett og forbruksoversikt</li>
        </ul>
      </div>
      {error && <Alert type="error" message={error} className="mb-4" />}
      <Button className="w-full justify-center" loading={loading} onClick={startDemo}>
        Start demo
      </Button>
    </div>
  );
}

// --- Wizard shell ---

export default function Onboarding() {
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
    <div className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-slide-up">
        {history.length > 1 && (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-6 transition-colors"
          >
            <ArrowLeftIcon size={14} />
            Tilbake
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
            <h2 className="text-xl font-semibold text-text mb-1">Importer fra Spiir</h2>
            <SpiirImportPanel onSuccess={() => navigate("/dashboard")} />
          </div>
        )}
        {current.kind === "import-own" && <StepImportOwn />}
        {current.kind === "restore" && <StepRestore navigate={navigate} />}
        {current.kind === "demo" && <StepDemo navigate={navigate} />}
      </div>
    </div>
  );
}
