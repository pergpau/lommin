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
        <p className="text-xs text-muted">{t("lastUpdated")}</p>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.controller.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacy:sections.controller.body"
              components={{
                email: <a href="mailto:lommin.pointer632@passmail.net" className="text-accent hover:underline" />,
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

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.noData.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.noData.body")}</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.localStorage.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">{t("sections.localStorage.body")}</p>
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

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.indexedDB.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">{t("sections.indexedDB.body1")}</p>
          <p className="text-sm text-muted leading-relaxed">{t("sections.indexedDB.body2")}</p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.proxy.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.proxy.body1"
              components={{ strong: <strong className="text-text/80" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.proxy.body2"
              components={{
                settingsLink: <Link to="/settings" className="text-accent hover:underline" />,
              }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacy:sections.proxy.body3"
              components={{
                hash: <span className="mono text-text/70" />,
                cfLink: (
                  <a
                    href="https://www.cloudflare.com/privacypolicy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  />
                ),
              }}
            />
          </p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.googleDrive.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.googleDrive.body1"
              components={{ mono: <span className="mono text-text/70" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.googleDrive.body2"
              components={{ mono: <span className="mono text-text/70" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacy:sections.googleDrive.body3"
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
              }}
            />
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.thirdParty.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.thirdParty.enableBanking"
              components={{
                strong: <strong className="text-text/80" />,
                ebLink: (
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
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.thirdParty.google"
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
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.thirdParty.cloudflare"
              components={{
                strong: <strong className="text-text/80" />,
                cfLink: (
                  <a
                    href="https://www.cloudflare.com/privacypolicy/"
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
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.legalBasis.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.legalBasis.body1"
              components={{ strong: <strong className="text-text/80" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            <Trans
              i18nKey="privacy:sections.legalBasis.body2"
              components={{ strong: <strong className="text-text/80" /> }}
            />
          </p>
          <p className="text-sm text-muted leading-relaxed">{t("sections.legalBasis.body3")}</p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.rights.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">{t("sections.rights.intro")}</p>
          <ul className="list-disc ml-4 text-sm text-muted space-y-2">
            <li className="leading-relaxed">
              <Trans
                i18nKey="privacy:sections.rights.access"
                components={{ strong: <strong className="text-text/80" /> }}
              />
            </li>
            <li className="leading-relaxed">
              <Trans
                i18nKey="privacy:sections.rights.erasure"
                components={{
                  strong: <strong className="text-text/80" />,
                  settingsLink: <Link to="/settings" className="text-accent hover:underline" />,
                }}
              />
            </li>
            <li className="leading-relaxed">
              <Trans
                i18nKey="privacy:sections.rights.portability"
                components={{ strong: <strong className="text-text/80" /> }}
              />
            </li>
            <li className="leading-relaxed">
              <Trans
                i18nKey="privacy:sections.rights.restriction"
                components={{ strong: <strong className="text-text/80" /> }}
              />
            </li>
            <li className="leading-relaxed">
              <Trans
                i18nKey="privacy:sections.rights.complaint"
                components={{
                  strong: <strong className="text-text/80" />,
                  dpaLink: (
                    <a
                      href="https://www.datatilsynet.no/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    />
                  ),
                }}
              />
            </li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">{t("sections.contact.heading")}</h2>
          <p className="text-sm text-muted leading-relaxed">
            <Trans
              i18nKey="privacy:sections.contact.body"
              components={{
                email: <a href="mailto:lommin.pointer632@passmail.net" className="text-accent hover:underline" />,
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
