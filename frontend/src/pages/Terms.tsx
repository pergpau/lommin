import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-xs text-muted hover:text-text transition-colors">← Tilbake</Link>
        <h1 className="text-2xl font-semibold text-text mt-4 mb-2">Brukervilkår</h1>
        <p className="text-xs text-muted">Gjelder fra: juni 2025</p>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Gratis å bruke, uten garanti</h2>
          <p className="text-sm text-muted leading-relaxed">
            Lommin er tilgjengelig gratis, som det er, uten noen form for garanti — verken uttrykkelig
            eller underforstått. Bruk på egen risiko. Vi gir ingen garantier for tilgjengelighet,
            nøyaktighet eller egnethet for noe bestemt formål.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Dine data, ditt ansvar</h2>
          <p className="text-sm text-muted leading-relaxed">
            Alle data lagres lokalt i nettleseren din. Vi har ikke tilgang til dem og kan ikke
            gjenopprette dem hvis du sletter nettleserlagringen. Ta sikkerhetskopi med den krypterte
            sikkerhetskopifunksjonen under Innstillinger.
          </p>
        </section>

        <section className="card p-5 border-l-2 border-accent/40">
          <h2 className="text-sm font-semibold text-text mb-2">Proxy-innsyn</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            API-forespørsler videresendes gjennom en proxy for å håndtere CORS. Proxyen ser det
            kortvarige Bearer-tokenet som er knyttet til hver forespørsel. Den ser ikke den private
            nøkkelen din.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Hvis dette er en bekymring, kan du sette opp din egen proxy og konfigurere den under{' '}
            <Link to="/settings" className="text-accent hover:underline">Innstillinger → CORS-proxy</Link>.
            Du kan kjøre den medfølgende Cloudflare Worker lokalt med{' '}
            <span className="mono text-text/70">wrangler dev</span>.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Enable Banking API</h2>
          <p className="text-sm text-muted leading-relaxed">
            Lommin bruker Enable Bankings API. Din bruk av dette API-et reguleres av Enable Bankings
            egne tjenestevilkår. Du er ansvarlig for å sikre at du har riktig legitimasjon og de
            nødvendige tillatelsene.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-2">Endringer</h2>
          <p className="text-sm text-muted leading-relaxed">
            Disse vilkårene kan oppdateres når som helst. Fortsatt bruk av Lommin etter endringer
            innebærer aksept av de oppdaterte vilkårene.
          </p>
        </section>
      </div>
    </div>
  )
}
