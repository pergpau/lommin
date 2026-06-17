import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";

export default function Terms() {
  const { t } = useTranslation("terms");

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
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.noWarranty.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.noWarranty.body")}</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.yourData.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.yourData.body")}</p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.proxy.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">{t("sections.proxy.body1")}</p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="terms:sections.proxy.body2"
              components={{
                settingsLink: <Link to="/settings" className="text-accent hover:underline" />,
                wrangler: <span className="mono text-text/70" />,
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.enableBanking.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.enableBanking.body")}</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.changes.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.changes.body")}</p>
        </section>
      </div>
    </div>
  );
}
