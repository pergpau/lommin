import { useCallback, useRef, useState } from "react";
import { importPemKey } from "../lib/keystore";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import { FileUpIcon } from "./ui/icons";

interface Props {
  onImported: (key: CryptoKey, appId: string) => void;
}

export default function PemImporter({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [pasteText, setPasteText] = useState("");

  const processKey = useCallback(
    async (pem: string, filename: string) => {
      setState("loading");
      setError("");
      try {
        const key = await importPemKey(pem);
        const stem = filename.replace(/(\.(pem|crt|key))+$/i, "");
        onImported(key, stem);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Klarte ikke å importere nøkkelen");
        setState("error");
      }
    },
    [onImported],
  );

  const onFile = useCallback(
    (file: File) => {
      file.text().then((text) => processKey(text, file.name));
    },
    [processKey],
  );

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-border">
        {(["file", "paste"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "file" ? "Last opp fil" : "Lim inn nøkkel"}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pem,.crt,.key,application/x-pem-file,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              dragging
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
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            onClick={() => inputRef.current?.click()}
          >
            {state === "loading" ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full" />
                <span className="text-muted text-xs">Importerer nøkkel…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
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
        </>
      )}

      {tab === "paste" && (
        <div>
          <textarea
            className="w-full h-40 font-mono text-xs border border-border rounded-lg p-3 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-accent resize-none mb-4"
            placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button
            className="w-full justify-center"
            loading={state === "loading"}
            onClick={() => {
              if (pasteText.trim()) void processKey(pasteText.trim(), "");
            }}
            disabled={!pasteText.trim()}
          >
            Importer nøkkel
          </Button>
        </div>
      )}

      {state === "error" && <Alert type="error" message={error} className="mt-3" />}
    </div>
  );
}
