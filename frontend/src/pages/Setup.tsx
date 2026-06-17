import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileUpIcon,
  ShieldIcon,
  UploadIcon,
} from "../components/ui/icons";
import { loadEncryptedFile } from "../lib/cryptoFile";
import {
  DriveAuthError,
  loadBackupFromDrive,
  signInWithGoogle,
} from "../lib/googleDrive";
import { importPemKey, saveKey } from "../lib/keystore";
import { persistDriveToken } from "../lib/settings";
import { importAll, validateImportData } from "../lib/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const REDIRECT_URL = "https://lommin.no/connect";
const PRIVACY_URL = "https://lommin.no/privacy";
const TERMS_URL = "https://lommin.no/terms";

function SetupGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copy(text, id)}
      className="ml-1.5 text-muted hover:text-accent transition-colors"
      title="Copy"
    >
      {copied === id ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
    </button>
  );

  const UrlRow = ({ label, value, id }: { label: string; value: string; id: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted w-28 flex-shrink-0">{label}</span>
      <span className="mono text-xs text-text/80 truncate">{value}</span>
      <CopyBtn text={value} id={id} />
    </div>
  );

  const Step = ({
    n,
    title,
    children,
  }: {
    n: number;
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mt-0.5">
        <span className="text-[10px] font-semibold text-accent leading-none">{n}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text mb-1">{title}</div>
        <div className="text-xs text-muted space-y-2 leading-relaxed">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="mb-6 border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-text hover:bg-surface/50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Har du ikke en Enable Banking-nøkkel ennå?</span>
        <ChevronDownIcon
          size={14}
          className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 pt-4 pb-5 space-y-5 animate-fade-in">
          <p className="text-xs text-muted">
            Enable Banking gir deg gratis tilgang til bank-APIer. Følg disse stegene for å hente
            signeringsnøkkelen din.
          </p>

          <Step n={1} title="Opprett en gratis konto">
            <p>
              Gå til{" "}
              <a
                href="https://enablebanking.com/sign-in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline inline-flex items-center gap-0.5"
              >
                https://enablebanking.com/sign-in/
                <ExternalLinkIcon size={10} />
              </a>{" "}
              og registrer deg. Bekreft e-postadressen din før du går videre.
            </p>
          </Step>

          <Step n={2} title="Opprett en applikasjon">
            <p>
              Klikk <strong className="text-text/80">Applications</strong> i menyen, deretter{" "}
              <strong className="text-text/80">New application</strong>.
            </p>
            <p>Fyll inn skjemaet med disse verdiene:</p>
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-1 mt-1">
              <div className="flex items-center justify-between py-1.5 border-b border-border">
                <span className="text-xs text-muted w-28 flex-shrink-0">Environment</span>
                <span className="mono text-xs font-semibold text-positive">Production</span>
                <span className="w-4" />
              </div>
              <UrlRow label="Privacy policy" value={PRIVACY_URL} id="privacy" />
              <UrlRow label="Terms of service" value={TERMS_URL} id="terms" />
              <UrlRow label="Redirect URL" value={REDIRECT_URL} id="redirect" />
            </div>
            <p className="mt-1">
              Applikasjonsnavnet kan være hva som helst — det vises kun i ditt eget dashboard.
            </p>
          </Step>

          <Step n={3} title="Koble til kontoene dine">
            <p>Link kontoene du vil synkronisere med Lommin.</p>
          </Step>

          <Step n={4} title="Last ned nøkkelfila">
            <p>
              Når du klikker <strong className="text-text/80">Registrer</strong> vil det lastes ned
              en fil av typen <span className="mono text-text/70">.pem</span>. Ta vare på denne —
              den kan ikke lastes ned igjen.
            </p>
          </Step>

          <Step n={5} title="Dra og slipp .pem-fila her">
            <p>
              Slipp fila i feltet nedenfor, eller klikk for å velge den fra datamaskinen din.
            </p>
          </Step>
        </div>
      )}
    </div>
  );
}

function RestoreForm() {
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const restore = useCallback(async () => {
    if (!passphrase) {
      setState("error");
      setMsg("Skriv inn passordet du brukte da du lagret sikkerhetskopien.");
      return;
    }
    setState("loading");
    setMsg("");
    try {
      const data = validateImportData(await loadEncryptedFile(passphrase));
      await importAll(data);
      const accounts = data.accounts.length;
      const txns = data.transactions.length;
      setState("done");
      setMsg(`Gjenopprettet ${accounts} konto(er) og ${txns} transaksjon(er).`);
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setState("idle");
        return;
      }
      setState("error");
      setMsg(e instanceof Error ? e.message : "Klarte ikke å gjenopprette sikkerhetskopien");
    }
  }, [passphrase, navigate]);

  return (
    <div className="border border-border rounded-xl p-4 animate-fade-in">
      <div className="text-sm font-medium text-text mb-1">Gjenopprett fra sikkerhetskopi</div>
      <p className="text-xs text-muted mb-3">
        Dekrypter og flett inn kontoer og transaksjoner fra en{" "}
        <span className="mono text-text/70">.enc</span>-sikkerhetskopi. Du må fortsatt importere
        signeringsnøkkelen ovenfor for å hente nye data.
      </p>
      <Input
        label="Passord"
        type="password"
        placeholder="Skriv inn passordet til sikkerhetskopien…"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") restore();
        }}
        className="mb-3"
      />
      <Button className="w-full justify-center" loading={state === "loading"} onClick={restore}>
        {state !== "loading" && <UploadIcon size={13} />}
        Velg fil og gjenopprett
      </Button>
      {msg && <Alert type={state === "error" ? "error" : "ok"} message={msg} className="mt-3" />}
    </div>
  );
}

function DriveRestoreForm() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [state, setState] = useState<"idle" | "connecting" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const connect = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setState("connecting");
    setMsg("");
    try {
      const { token: t, expiresIn } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(t, expiresIn);
      setToken(t);
      setState("idle");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Tilkobling feilet");
    }
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setState("loading");
    setMsg("");
    try {
      const data = validateImportData(await loadBackupFromDrive(token, passphrase));
      await importAll(data);
      const accounts = data.accounts.length;
      const txns = data.transactions.length;
      setState("done");
      setMsg(`Gjenopprettet ${accounts} konto(er) og ${txns} transaksjon(er).`);
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (e) {
      if (e instanceof DriveAuthError) setToken(null);
      setState("error");
      setMsg(e instanceof Error ? e.message : "Klarte ikke å laste fra Google Drive");
    }
  }, [token, passphrase, navigate]);

  return (
    <div className="border border-border rounded-xl p-4 animate-fade-in">
      <div className="text-sm font-medium text-text mb-1">Gjenopprett fra Google Drive</div>
      <p className="text-xs text-muted mb-3">
        Last ned og dekrypter sikkerhetskopien din fra Google Drive.
      </p>
      {!token ? (
        <Button
          className="w-full justify-center"
          loading={state === "connecting"}
          onClick={connect}
        >
          Koble til Google Drive
        </Button>
      ) : (
        <>
          <Input
            label="Passord"
            type="password"
            placeholder="La stå tomt hvis du ikke har brukt passord"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            className="mb-3"
          />
          <Button
            className="w-full justify-center"
            loading={state === "loading"}
            onClick={load}
          >
            {state !== "loading" && <UploadIcon size={13} />}
            Last fra Drive
          </Button>
        </>
      )}
      {msg && <Alert type={state === "error" ? "error" : "ok"} message={msg} className="mt-3" />}
    </div>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKey = useRef<CryptoKey | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "confirm" | "done" | "error">("idle");
  const [appId, setAppId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [showRestore, setShowRestore] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setState("loading");
    setError("");
    try {
      const pem = await file.text();
      const stem = file.name.replace(/(\.(pem|crt|key))+$/i, "");
      const key = await importPemKey(pem);
      pendingKey.current = key;
      setAppId(stem);
      setState("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Klarte ikke å importere nøkkelen");
      setState("error");
    }
  }, []);

  const confirmAppId = useCallback(async () => {
    if (!pendingKey.current || !appId.trim()) return;
    setConfirming(true);
    try {
      await saveKey(pendingKey.current, appId.trim());
      setState("done");
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Klarte ikke å lagre nøkkelen");
      setState("error");
    } finally {
      setConfirming(false);
    }
  }, [appId, navigate]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8">
          <div className="mono text-accent text-sm mb-3 tracking-widest uppercase">Lommin</div>
          <h1 className="text-2xl font-semibold text-text tracking-tight leading-tight">
            Få kontroll på pengebruken
          </h1>
          <p className="text-muted text-sm mt-3 leading-relaxed">
            Lommin kobler seg direkte til bankkontoene og kredittkortene dine og gir deg et klart bilde av forbruket
            ditt — kategorisert og alltid oppdatert.
          </p>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            For å komme i gang laster du opp signeringsnøkkelen din fra Enable Banking. Den lagres
            kryptert på enheten din og forlater den aldri.
          </p>
        </div>

        <SetupGuide />

        {state !== "confirm" && state !== "done" && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-border-2 hover:bg-surface/50"
              }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pem,.crt,.key,application/x-pem-file,application/x-x509-ca-cert,application/octet-stream,text/plain"
              className="hidden"
              onChange={onFileChange}
            />
            {state === "loading" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full" />
                <span className="text-muted text-sm">Importerer nøkkel…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <FileUpIcon size={20} className="text-muted" />
                </div>
                <div>
                  <div className="text-sm text-text font-medium">
                    {dragging ? "Slipp for å importere" : "Slipp .pem-fila her"}
                  </div>
                  <div className="text-xs text-muted mt-0.5">eller klikk for å velge fil</div>
                </div>
              </div>
            )}
          </div>
        )}

        {state === "confirm" && (
          <div className="border border-border rounded-xl p-5 animate-fade-in space-y-4">
            <div>
              <div className="text-sm font-medium text-text mb-1">Bekreft App ID</div>
              <p className="text-xs text-muted leading-relaxed">
                App ID-en er hentet fra filnavnet. Sjekk at den stemmer med ID-en i{" "}
                <a
                  href="https://enablebanking.com/sign-in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Enable Banking-dashbordet
                </a>{" "}
                ditt. På mobil kan filnavnet noen ganger endres automatisk.
              </p>
            </div>
            <Input
              label="App ID"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmAppId(); }}
              className="font-mono"
              autoFocus
            />
            <Button
              className="w-full justify-center"
              loading={confirming}
              onClick={confirmAppId}
              disabled={!appId.trim()}
            >
              Lagre og fortsett
            </Button>
          </div>
        )}

        {state === "done" && (
          <div className="border border-positive/20 bg-positive/5 rounded-xl p-6 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckIcon size={16} className="text-positive" />
              </div>
              <div>
                <div className="text-sm font-medium text-text">Nøkkel importert</div>
                <div className="mono text-xs text-muted mt-1 break-all">{appId}</div>
                <div className="text-xs text-muted mt-2">Sender deg til dashbordet…</div>
              </div>
            </div>
          </div>
        )}

        {state === "error" && <Alert type="error" message={error} className="mt-4" />}

        <div className="mt-4">
          {!showRestore ? (
            <button
              className="text-xs text-muted hover:text-text transition-colors"
              onClick={() => setShowRestore(true)}
            >
              Har du allerede en fil lagret lokalt eller på Google Drive?{" "}
              <span className="text-accent">Gjenopprett</span>
            </button>
          ) : (
            <div className="space-y-3">
              <RestoreForm />
              {GOOGLE_CLIENT_ID && <DriveRestoreForm />}
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-border space-y-3">
          <div className="flex items-start gap-2">
            <ShieldIcon size={14} className="text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              Nøkkelen lagres som en ikke-uttrekkbar <span className="mono">CryptoKey</span> i
              IndexedDB. De rå nøkkelbytene kan ikke leses ut av JavaScript etter import.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangleIcon size={14} className="text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              <span className="text-text/80">Merk:</span> bank-API-kall sendes via en proxy, som kan
              se transaksjonsdata og korttidsgyldige tilgangstokener i transitt (den mottar aldri
              nøkkelen din). For full personvern, pek{" "}
              <span className="mono">Innstillinger → CORS-proxy</span> mot din egen server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
