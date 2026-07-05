import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";

export default function PrivacyTerms() {
  const { t } = useTranslation("privacyTerms");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-xs text-muted hover:text-text transition-colors">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold text-text mt-4 mb-2">{t("title")}</h1>
        <p className="text-xs text-muted">{t("lastUpdated")}</p>
      </div>

      <div className="space-y-4">
        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.selfHosted.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacyTerms:sections.selfHosted.body"
              components={{
                github: (
                  <a
                    href="https://github.com/pergpau/lommin/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.selfHosted.selfHostWarning"
              components={{ strong: <strong className="text-text/80" /> }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.signingKey.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.signingKey.body"
              components={{
                pem: <span className="mono text-text/70" />,
                crypto: <span className="mono text-text/70" />,
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.indexedDB.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-3">{t("sections.indexedDB.body1")}</p>
          <p className="text-sm text-muted leading-relaxed mb-3">{t("sections.indexedDB.body2")}</p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.indexedDB.body3"
              components={{
                settingsLink: <Link to="/settings" className="text-accent hover:underline" />,
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.dataPortability.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.dataPortability.body")}</p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.proxy.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.proxy.body1"
              components={{ strong: <strong className="text-text/80" /> }}
            />
          </p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.googleDrive.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacyTerms:sections.googleDrive.body1"
              components={{ mono: <span className="mono text-text/70" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacyTerms:sections.googleDrive.body2"
              components={{ mono: <span className="mono text-text/70" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.googleDrive.body3"
              components={{
                strong: <strong className="text-text/80" />,
                googleLink: (
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
                termsLink: (
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.thirdParty.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacyTerms:sections.thirdParty.enableBanking"
              components={{
                strong: <strong className="text-text/80" />,
                termsLink: (
                  <a
                    href="https://enablebanking.com/terms-of-service/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
                privacyLink: (
                  <a
                    href="https://enablebanking.com/privacy-policy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.thirdParty.google"
              components={{
                strong: <strong className="text-text/80" />,
                googleLink: (
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">
            {t("sections.openSource.heading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.openSource.body"
              components={{
                repoLink: (
                  <a
                    href="https://github.com/pergpau/lommin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.license.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.license.body"
              components={{
                licenseLink: (
                  <a
                    href="https://polyformproject.org/licenses/noncommercial/1.0.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.changes.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.changes.body")}</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.contact.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacyTerms:sections.contact.body"
              components={{
                github: (
                  <a
                    href="https://github.com/pergpau/lommin/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
        </section>
      </div>
    </div>
  );
}
