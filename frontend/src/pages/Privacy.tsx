import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-xs text-muted hover:text-text transition-colors">← Tilbake</Link>
        <h1 className="text-2xl font-semibold text-text mt-4 mb-2">Personvernerklæring</h1>
        <p className="text-xs text-muted">Gjelder fra: juni 2025</p>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Vi samler ingen data</h2>
          <p className="text-sm text-muted leading-relaxed">
            Lommin samler ikke inn, lagrer eller overfører noen personopplysninger til noen server vi
            drifter. Det er ingen analyse, ingen sporingsskript, ingen informasjonskapsler og ingen
            kontoer. Alt — signeringsnøkkelen din, transaksjonshistorikk og innstillinger — ligger
            utelukkende i nettleserens IndexedDB.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Signeringsnøkkelen din</h2>
          <p className="text-sm text-muted leading-relaxed">
            Den private <span className="mono text-text/70">.pem</span>-nøkkelen din importeres som
            et ikke-ekstraherbart <span className="mono text-text/70">CryptoKey</span>-objekt. Rå
            nøkkelmateriale er aldri tilgjengelig for JavaScript etter import og forlater aldri
            enheten din.
          </p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">Proxyen og tilgangstokenet ditt</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            For å omgå nettleserens CORS-begrensninger rutes API-kall til Enable Banking gjennom en
            proxy. Denne proxyen ser <strong className="text-text/80">det kortvarige tilgangstokenet</strong> (Bearer-token)
            som brukes til å autorisere hver forespørsel — ikke den private nøkkelen din.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Som standard bruker Lommin en delt proxy. Ønsker du full kontroll, kan du kjøre din egen
            proxy og peke Lommin mot den under{' '}
            <Link to="/settings" className="text-accent hover:underline">Innstillinger → CORS-proxy</Link>.
            Selvhosting av proxyen betyr at ingen tredjepart ser noen del av økten din.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Tredjepartstjenester</h2>
          <p className="text-sm text-muted leading-relaxed">
            Lommin kommuniserer med Enable Bankings API på dine vegne, ved hjelp av legitimasjon du
            oppgir. Enable Bankings egen personvernerklæring regulerer hva de gjør med disse
            forespørslene. Lommin har ingen innsikt i det.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Kontakt</h2>
          <p className="text-sm text-muted leading-relaxed">
            Spørsmål? Åpne et issue eller ta kontakt via prosjektets repository.
          </p>
        </section>
      </div>
    </div>
  )
}
