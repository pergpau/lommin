import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";

export default function Privacy() {
  const { t } = useTranslation("privacy");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-xs text-muted hover:text-text transition-colors">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold text-text mt-4 mb-2">{t("title")}</h1>
        <p className="text-xs text-muted">{t("effectiveDate")}</p>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.noData.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.noData.body")}</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.signingKey.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacy:sections.signingKey.body"
              components={{
                pem: <span className="mono text-text/70" />,
                crypto: <span className="mono text-text/70" />,
              }}
            />
          </p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.proxy.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.proxy.body1"
              components={{ strong: <strong className="text-text/80" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacy:sections.proxy.body2"
              components={{
                settingsLink: <Link to="/settings" className="text-accent hover:underline" />,
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.thirdParty.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.thirdParty.body")}</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.contact.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.contact.body")}</p>
        </section>
      </div>
    </div>
  );
}
