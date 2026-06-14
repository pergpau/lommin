import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { CheckIcon, ChevronLeftIcon } from '../components/ui/icons'
import Spinner from '../components/ui/Spinner'
import { SESSION_VALID_DAYS } from '../constants'
import { createSession, initiateAuth, listBanks, type BankEntry } from '../lib/enableBanking'
import { getAccounts, saveAccount, type Account, type AccountSource } from '../lib/store'
import { syncAccounts } from '../lib/sync'

const COUNTRIES = [
  { code: 'NO', name: 'Norge' },
  { code: 'SE', name: 'Sverige' },
  { code: 'FI', name: 'Finland' },
  { code: 'DK', name: 'Danmark' },
  { code: 'GB', name: 'Storbritannia' },
  { code: 'DE', name: 'Tyskland' },
  { code: 'FR', name: 'Frankrike' },
  { code: 'NL', name: 'Nederland' },
]

const STATE_KEY = 'lommin_auth_state'
const BANK_KEY = 'lommin_auth_bank'
const BANK_COUNTRY_KEY = 'lommin_auth_bank_country'

type Phase = 'pick' | 'connecting' | 'callback' | 'syncing' | 'done' | 'error'

function phaseFromUrl(): Phase {
  const sp = new URLSearchParams(window.location.search)
  if (sp.get('code')) return 'callback'
  if (sp.get('reauth') || sp.get('uid')) return 'connecting'
  return 'pick'
}

export default function Connect() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const [country, setCountry] = useState('NO')
  const [banks, setBanks] = useState<BankEntry[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<BankEntry | null>(null)
  // Derived from URL on mount — no need to setPhase synchronously in effects
  const [phase, setPhase] = useState<Phase>(phaseFromUrl)
  const [error, setError] = useState('')
  const [syncMsg, setSyncMsg] = useState('')
  // Track which country was last loaded to derive loading state without sync setState in effect
  const [loadedCountry, setLoadedCountry] = useState<string | null>(null)
  // Guard against React StrictMode double-firing effects that consume localStorage
  const callbackStarted = useRef(false)
  const reauthStarted = useRef(false)
  const [previousBanks, setPreviousBanks] = useState<Array<{ name: string; country: string }>>([])
  const quickConnectStarted = useRef(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks
  }, [query, banks])

  // No synchronous setPhase call — caller sets connecting before invoking
  const initiateConnectFor = useCallback(async (aspsp: { name: string; country: string }) => {
    try {
      const state = crypto.randomUUID()
      localStorage.setItem(STATE_KEY, state)
      localStorage.setItem(BANK_KEY, aspsp.name)
      localStorage.setItem(BANK_COUNTRY_KEY, aspsp.country)
      const validUntil = new Date(Date.now() + SESSION_VALID_DAYS * 86400_000)
        .toISOString()
        .replace(/\.\d+Z$/, 'Z')
      const redirectUrl = `${window.location.origin}/connect`
      const url = await initiateAuth({ aspsp, redirectUrl, validUntil, state })
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke starte autentisering')
      setPhase('error')
    }
  }, [])

  // Event handler — setPhase is safe here (not an effect body)
  const connect = useCallback(async () => {
    if (!selected) return
    setPhase('connecting')
    await initiateConnectFor(selected)
  }, [selected, initiateConnectFor])

  // Load previously connected banks from saved accounts
  useEffect(() => {
    if (params.get('code') || params.get('reauth') || params.get('uid')) return
    getAccounts().then((accounts) => {
      const seen = new Set<string>()
      const unique: Array<{ name: string; country: string }> = []
      for (const acc of accounts) {
        if (!acc.bankName || !acc.bankCountry) continue
        const key = `${acc.bankCountry}::${acc.bankName}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push({ name: acc.bankName, country: acc.bankCountry })
        }
      }
      setPreviousBanks(unique)
    })
  }, [params])

  const quickConnect = useCallback(
    (bank: { name: string; country: string }) => {
      if (quickConnectStarted.current) return
      quickConnectStarted.current = true
      setPhase('connecting')
      initiateConnectFor(bank)
    },
    [initiateConnectFor],
  )

  // Handle OAuth callback — phase is already 'callback' from phaseFromUrl()
  // All setState calls are inside async .then()/.catch() callbacks
  useEffect(() => {
    const code = params.get('code')
    const returnedState = params.get('state')
    if (!code) return
    if (callbackStarted.current) return
    callbackStarted.current = true

    const storedState = localStorage.getItem(STATE_KEY)
    const csrfError =
      !storedState || !returnedState || returnedState !== storedState
        ? 'State-mismatch — mulig CSRF. Oppdater siden og prøv igjen.'
        : null

    localStorage.removeItem(STATE_KEY)
    const bankName = !csrfError ? (localStorage.getItem(BANK_KEY) ?? undefined) : undefined
    const bankCountry = !csrfError ? (localStorage.getItem(BANK_COUNTRY_KEY) ?? undefined) : undefined
    localStorage.removeItem(BANK_KEY)
    localStorage.removeItem(BANK_COUNTRY_KEY)

      // Drive all state transitions through the async chain — no sync setState
      ; (csrfError ? Promise.reject(new Error(csrfError)) : createSession(code))
        .then(async ({ sessionId, accounts }) => {
          const existing = await getAccounts()
          const saved: Account[] = []
          for (const acc of accounts) {
            const normBban = (s: string) => s.replace(/\D/g, '')
            const match = existing.find(
              (e) =>
                (acc.identificationHash && e.identificationHash && acc.identificationHash === e.identificationHash) ||
                (acc.iban && e.iban && acc.iban === e.iban) ||
                (acc.bban && e.bban && normBban(acc.bban) === normBban(e.bban)),
            )
            const ebSource: AccountSource = { type: 'enableBanking', sourceId: acc.uid, sessionId }
            let record: Account
            if (match) {
              const otherSources = match.sources.filter(
                (s) => !(s.type === 'enableBanking' && s.sourceId === acc.uid),
              )
              record = {
                ...match,
                name: acc.name ?? match.name,
                bankName: bankName ?? match.bankName,
                bankCountry: bankCountry ?? match.bankCountry,
                currency: acc.currency ?? match.currency,
                iban: acc.iban ?? match.iban,
                bban: acc.bban ?? match.bban,
                identificationHash: acc.identificationHash ?? match.identificationHash,
                identificationHashes: acc.identificationHashes ?? match.identificationHashes,
                sources: [...otherSources, ebSource],
              }
            } else {
              record = {
                uid: crypto.randomUUID(),
                name: acc.name,
                bankName,
                bankCountry,
                currency: acc.currency,
                iban: acc.iban,
                bban: acc.bban,
                identificationHash: acc.identificationHash,
                identificationHashes: acc.identificationHashes,
                addedAt: Date.now(),
                sources: [ebSource],
              }
            }
            await saveAccount(record)
            saved.push(record)
          }
          setPhase('syncing')
          try {
            await syncAccounts(saved, setSyncMsg)
          } catch { /* dashboard sync button can retry */ }
          setPhase('done')
          setTimeout(() => navigate('/dashboard'), 800)
        })
        .catch((e: Error) => {
          setError(e.message)
          setPhase('error')
        })
  }, [params, navigate])

  // Auto-initiate re-auth — phase is already 'connecting' from phaseFromUrl()
  // Defer initiateConnectFor via Promise so no sync setState in effect body
  useEffect(() => {
    if (params.get('code')) return
    const reauth = params.get('reauth')
    const reauthCountry = params.get('country')
    const uid = params.get('uid')

    if (reauth && reauthCountry) {
      if (!reauthStarted.current) {
        reauthStarted.current = true
        Promise.resolve({ name: reauth, country: reauthCountry }).then(initiateConnectFor)
      }
      return
    }

    if (uid) {
      if (!reauthStarted.current) {
        reauthStarted.current = true
        getAccounts().then((accounts) => {
          const acc = accounts.find((a) => a.uid === uid)
          if (acc?.bankName && acc?.bankCountry) {
            initiateConnectFor({ name: acc.bankName, country: acc.bankCountry })
          } else {
            navigate('/connect')
          }
        })
      }
    }
  }, [params, initiateConnectFor, navigate])

  // Load banks — all setState calls are in async callbacks
  useEffect(() => {
    if (params.get('code') || params.get('reauth') || params.get('uid')) return
    listBanks(country)
      .then((list) => {
        setBanks(list)
        setLoadedCountry(country)
        setPhase('pick')
      })
      .catch((e) => {
        setError(e.message)
        setPhase('error')
      })
  }, [country, params])

  const isReauth = (!!params.get('reauth') || !!params.get('uid')) && !params.get('code')
  const isOAuthFlow = !!(params.get('code') || params.get('reauth') || params.get('uid'))
  const banksLoading = !isOAuthFlow && phase !== 'error' && loadedCountry !== country

  if (isReauth && phase !== 'error') {
    return (
      <div className="min-h-screen bg-bg grid-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Spinner size={32} />
          <div className="text-muted text-sm mt-4">Kobler til bank…</div>
        </div>
      </div>
    )
  }

  if (phase === 'callback' || phase === 'syncing' || phase === 'done') {
    return (
      <div className="min-h-screen bg-bg grid-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          {phase === 'done' ? (
            <>
              <div className="w-12 h-12 rounded-full bg-positive/10 border border-positive/20 flex items-center justify-center mx-auto mb-4">
                <CheckIcon size={22} className="text-positive" />
              </div>
              <div className="text-text font-medium">Tilkoblet</div>
              <div className="text-muted text-sm mt-1">Laster oversikt…</div>
            </>
          ) : (
            <>
              <Spinner size={32} />
              <div className="text-muted text-sm mt-4">
                {phase === 'syncing' ? (syncMsg || 'Henter transaksjoner…') : 'Oppretter økt…'}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-muted text-xs hover:text-text transition-colors mb-6">
            <ChevronLeftIcon size={12} />
            Oversikt
          </Link>
        </div>
        <div className="mb-6">
          <div className="mono text-accent text-sm mb-3 tracking-widest uppercase">Steg 2</div>
          <h1 className="text-2xl font-semibold text-text tracking-tight">Koble til en bank</h1>
          <p className="text-muted text-sm mt-1">
            Velg land og bank. Du blir videresendt for å gi tilgang.
          </p>
        </div>

        {phase === 'error' && <Alert type="error" message={error} className="mb-4" />}

        {previousBanks.length > 0 && phase !== 'connecting' && (
          <Card className="p-4 mb-4">
            <label className="label">Tidligere tilkoblede banker</label>
            <div className="flex flex-col gap-1.5 mt-1">
              {previousBanks.map((bank) => (
                <button
                  key={`${bank.country}::${bank.name}`}
                  onClick={() => quickConnect(bank)}
                  className="w-full text-left px-3 py-2 rounded text-sm text-text hover:bg-surface-2 border border-border/40 transition-colors flex items-center justify-between group"
                >
                  <span>{bank.name}</span>
                  <span className="text-muted text-xs group-hover:text-accent transition-colors">Koble til →</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4 mb-4">
          <label className="label">Land</label>
          <select
            className="input bg-surface-2"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value)
              setSelected(null)
              setQuery('')
            }}
            disabled={banksLoading || phase === 'connecting'}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </Card>

        <Card className="p-4 mb-4">
          <label className="label">Bank</label>
          {banksLoading ? (
            <div className="flex items-center gap-2 text-muted text-sm py-2">
              <Spinner size={14} />
              <span>Laster banker…</span>
            </div>
          ) : (
            <>
              <input
                ref={searchRef}
                className="input mb-3"
                placeholder="Søk banker…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="max-h-56 overflow-y-auto -mx-1 space-y-0.5">
                {filtered.length === 0 && (
                  <div className="text-muted text-sm px-2 py-4 text-center">Ingen banker funnet</div>
                )}
                {filtered.map((bank) => (
                  <button
                    key={bank.name}
                    onClick={() => setSelected(bank)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selected?.name === bank.name
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'text-text hover:bg-surface-2'
                      }`}
                  >
                    {bank.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        <Button
          className="w-full py-2.5 justify-center"
          disabled={!selected || phase === 'connecting'}
          loading={phase === 'connecting'}
          onClick={connect}
        >
          {phase !== 'connecting' && <>Koble til {selected ? `"${selected.name}"` : 'bank'} →</>}
          {phase === 'connecting' && 'Videresender…'}
        </Button>
      </div>
    </div>
  )
}
