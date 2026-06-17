import { useCallback, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "./ui/icons";

const REDIRECT_URL = "https://lommin.no/connect";
const PRIVACY_URL = "https://lommin.no/privacy";
const TERMS_URL = "https://lommin.no/terms";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }, []);
  return { copied, copy };
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
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
}

export default function BankSetupGuide() {
  const { t } = useTranslation("components");
  const { copied, copy } = useCopy();

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copy(text, id)}
      className="ml-1.5 text-muted hover:text-accent transition-colors flex-shrink-0"
      title={t("bankSetupGuide.copyTooltip")}
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

  return (
    <div className="space-y-5">
      <Step n={1} title={t("bankSetupGuide.step1.title")}>
        <p>
          <Trans
            i18nKey="components:bankSetupGuide.step1.body"
            components={{
              link: (
                <a
                  href="https://enablebanking.com/sign-in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-0.5"
                >
                  enablebanking.com
                  <ExternalLinkIcon size={10} />
                </a>
              ),
            }}
          />
        </p>
      </Step>

      <Step n={2} title={t("bankSetupGuide.step2.title")}>
        <p>
          <Trans
            i18nKey="components:bankSetupGuide.step2.body"
            components={{
              app: <strong className="text-text/80" />,
              newapp: <strong className="text-text/80" />,
            }}
          />
        </p>
        <div className="rounded-lg border border-border bg-surface/50 px-3 py-1 mt-2">
          <div className="flex items-center justify-between py-1.5 border-b border-border">
            <span className="text-xs text-muted w-28 flex-shrink-0">Environment</span>
            <span className="mono text-xs font-semibold text-positive">Production</span>
            <span className="w-4" />
          </div>
          <UrlRow label="Privacy policy" value={PRIVACY_URL} id="privacy" />
          <UrlRow label="Terms of service" value={TERMS_URL} id="terms" />
          <UrlRow label="Redirect URL" value={REDIRECT_URL} id="redirect" />
        </div>
      </Step>

      <Step n={3} title={t("bankSetupGuide.step3.title")}>
        <p>{t("bankSetupGuide.step3.body")}</p>
      </Step>

      <Step n={4} title={t("bankSetupGuide.step4.title")}>
        <p>
          <Trans
            i18nKey="components:bankSetupGuide.step4.body"
            components={{
              register: <strong className="text-text/80" />,
              pem: <span className="mono text-text/70" />,
            }}
          />
        </p>
      </Step>
    </div>
  );
}
