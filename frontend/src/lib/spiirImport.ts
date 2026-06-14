import JSZip from 'jszip'
import { type Account, type Transaction } from './store'
import { guessCategory } from './autoCategorize'

// Maps Spiir subcategory IDs (from CategoryId / SubcategoryId columns) to own category IDs.
// Spiir IDs not listed here are treated as unrecognised and fall back to guessCategory().
const SPIIR_CATEGORY_MAP: Record<number, number> = {
  // --- Skjul / Ekskluder ---
  100: 100, // Overføring
  101: 101, // Delt utgift
  102: 102, // Ekskluder

  // --- Inntekt ---
  103: 103, // Lønn
  105: 104, // Dagpenger
  110: 105, // Renteinntekter
  111: 106, // Avkastning & Utbytte
  112: 107, // Tilbakebetalt skatt
  113: 108, // Andre inntekter

  // --- Bolig ---
  114: 109, // Lån/Husleie
  115: 110, // Strøm & Energi
  116: 111, // Felleskostnader
  118: 112, // Bygningsforsikring
  119: 113, // Innboforsikring
  122: 114, // Oppussing & Reparasjon
  187: 115, // Andre boutgifter
  195: 116, // Hage & Planter

  // --- Bil & Transport ---
  123: 117, // Billån m.m.
  124: 118, // Drivstoff
  125: 119, // Bilforsikring & Assistanse
  126: 120, // Årsavgift & Engangsavgift
  127: 121, // Kollektivtransport
  128: 122, // Taxi
  129: 123, // Parkering
  130: 124, // Garasje & Bildeler
  131: 125, // Annen transport

  // --- Dagligvarer & Mat ---
  132: 126, // Dagligvarer
  133: 127, // Kiosk & Delikatesser
  192: 128, // Matkasse

  // --- Reise ---
  135: 130, // Fly & Hotell
  138: 131, // Leiebil
  139: 132, // Feriehus & Camping
  140: 133, // Ferieaktiviteter

  // --- Faste utgifter ---
  134: 134, // Apotek
  144: 135, // Fagforening & Dagpengeforsikring
  148: 136, // TV & Strømming
  149: 137, // Telefon & Internett
  153: 138, // Legespesialist
  154: 139, // Briller & Linser
  189: 140, // Utdanning
  191: 141, // Medlemskap

  // --- Fritid ---
  147: 142, // Sport & Fritid
  155: 143, // Fast Food & Take Away
  156: 144, // Restaurant & Bar
  157: 145, // Klær & Accessoarer
  158: 146, // Møbler & Interiør
  159: 147, // Elektronikk & Data
  160: 148, // Spill & Leketøy
  161: 149, // Hobby & Sportsutstyr
  162: 150, // Frisør & Personlig pleie
  163: 151, // Film, Musikk & Bøker
  164: 152, // Kino, Konserter & Underholdning
  165: 153, // Spill & Odds
  168: 154, // Kjæledyr
  169: 155, // Gaver & Veldedighet
  170: 156, // Annet privat forbruk
  186: 157, // Nettjenester & Programvare
  188: 158, // Tobakk & Alkohol
  194: 159, // Rådgivere & Tjenester

  // --- Annet ---
  171: 160, // Ukjent
  174: 161, // Bankgebyrer
  176: 162, // Bøter
  177: 163, // Restskatt
  196: 164, // Offentlig gebyr

  // --- Gjeld & Renter ---
  178: 165, // Studielån
  179: 166, // Forbrukslån
  180: 167, // Privatlån (Venner & Familie)
  181: 168, // Renter

  // --- Pensjon & Sparing ---
  184: 169, // Annen sparing
}

function mapSpiirCategory(spiirId: number | undefined): number | undefined {
  if (spiirId === undefined || isNaN(spiirId)) return undefined
  return SPIIR_CATEGORY_MAP[spiirId]
}

export interface SpiirAccount {
  accountId: string
  name: string
  currency: string
  bankName?: string
  iban?: string
  bban?: string
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// Proper CSV parser that handles multi-line quoted fields.
// Some Spiir description fields contain embedded newlines, so we must not
// split on \n first — we track quote state across the whole text.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let fields: string[] = []
  let field = ''
  let inQuote = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2 }
        else { inQuote = false; i++ }
      } else {
        field += ch; i++
      }
    } else {
      if (ch === '"') { inQuote = true; i++ }
      else if (ch === ';') { fields.push(field); field = ''; i++ }
      else if (ch === '\r') { i++ }
      else if (ch === '\n') {
        fields.push(field); field = ''
        rows.push(fields); fields = []; i++
      } else {
        field += ch; i++
      }
    }
  }

  if (field || fields.length > 0) { fields.push(field); rows.push(fields) }
  return rows
}

function convertDate(ddmmyyyy: string): string {
  // DD-MM-YYYY → YYYY-MM-DD
  const [d, m, y] = ddmmyyyy.split('-')
  return `${y}-${m}-${d}`
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(',', '.'))
}

function buildHeaderIndex(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {}
  headers.forEach((h, i) => { idx[h] = i })
  return idx
}

export function parseSpiirCsvAccounts(text: string): SpiirAccount[] {
  const rows = parseCsvRows(stripBom(text))
  if (rows.length < 2) return []
  const idx = buildHeaderIndex(rows[0])
  const seen = new Set<string>()
  const accounts: SpiirAccount[] = []
  for (let i = 1; i < rows.length; i++) {
    const f = rows[i]
    const accountId = f[idx['AccountId']]
    if (!accountId || seen.has(accountId)) continue
    seen.add(accountId)
    accounts.push({
      accountId,
      name: f[idx['AccountName']] || accountId,
      currency: f[idx['Currency']] || 'NOK',
    })
  }
  return accounts
}

// accountMap: SpiirAccountId → target uid
// Use `spiir::${accountId}` as a sentinel meaning "create new account"; an existing uid for merges.
export function buildImportPayload(
  text: string,
  accountMap: Record<string, string>,
): { accounts: Account[]; transactions: Transaction[] } {
  const rows = parseCsvRows(stripBom(text))
  if (rows.length < 2) return { accounts: [], transactions: [] }
  const idx = buildHeaderIndex(rows[0])

  // Resolve sentinel values to fresh UUIDs before processing rows
  const resolvedUids: Record<string, string> = {}
  const createSet = new Set<string>()
  for (const [spiirId, mapped] of Object.entries(accountMap)) {
    if (mapped.startsWith('spiir::')) {
      resolvedUids[spiirId] = crypto.randomUUID()
      createSet.add(spiirId)
    } else {
      resolvedUids[spiirId] = mapped
    }
  }

  const accountsById: Record<string, Account> = {}
  const transactions: Transaction[] = []
  const now = Date.now()

  for (let i = 1; i < rows.length; i++) {
    const f = rows[i]

    const spiirId = f[idx['Id']]
    const spiirAccountId = f[idx['AccountId']]
    const amountRaw = f[idx['Amount']]
    if (!spiirId || !spiirAccountId || !amountRaw) continue

    const amount = parseAmount(amountRaw)
    if (amount === 0 || isNaN(amount)) continue

    if (!resolvedUids[spiirAccountId]) {
      resolvedUids[spiirAccountId] = crypto.randomUUID()
      createSet.add(spiirAccountId)
    }
    const targetUid = resolvedUids[spiirAccountId]
    const currency = f[idx['Currency']] || 'NOK'

    // Create Account record only for new (non-merged) accounts
    if (createSet.has(spiirAccountId) && !accountsById[targetUid]) {
      accountsById[targetUid] = {
        uid: targetUid,
        name: f[idx['AccountName']] || spiirAccountId,
        bankName: 'Spiir',
        currency,
        sources: [{ type: 'spiir', sourceId: spiirAccountId }],
        addedAt: now,
      }
    }

    const dateRaw = f[idx['Date']]
    const bookingDate = dateRaw ? convertDate(dateRaw) : undefined
    const categoryIdRaw = f[idx['CategoryId']]
    const csvCategoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : undefined
    const parsedCsvCategoryId = csvCategoryId && !isNaN(csvCategoryId) ? csvCategoryId : undefined

    const entryReference = spiirId
    const id = `${targetUid}::${entryReference}`

    const tx: Transaction = {
      id,
      accountUid: targetUid,
      entryReference,
      bookingDate,
      amount,
      currency,
      creditDebit: amount > 0 ? 'CRDT' : 'DBIT',
      description: f[idx['Description']] || '',
      status: 'BOOK',
      raw: {
        originalDescription: f[idx['OriginalDescription']],
        balance: f[idx['Balance']],
        comment: f[idx['Comment']],
        accountName: f[idx['AccountName']],
      },
    }
    tx.categoryId = mapSpiirCategory(parsedCsvCategoryId) ?? guessCategory(tx)
    transactions.push(tx)
  }

  return { accounts: Object.values(accountsById), transactions }
}

// --- ZIP (full data dump) import ---

function bankIdToName(bankId: string): string {
  const camel = bankId.split('_').slice(1).join('')
  // Split on lowercase→uppercase and on uppercase-run→cap+lower transitions
  return camel
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
}

function findZipFile(zip: JSZip, name: string): JSZip.JSZipObject | null {
  const direct = zip.file(name)
  if (direct) return direct
  let found: JSZip.JSZipObject | null = null
  zip.forEach((path, f) => {
    if (!f.dir && (path === name || path.endsWith('/' + name))) found = f
  })
  return found
}

function parseAccountNumber(raw: string): { iban?: string; bban?: string } {
  try {
    const obj = JSON.parse(raw)
    return {
      iban: obj?.Iban ?? undefined,
      bban: obj?.Bban ?? undefined,
    }
  } catch {
    return {}
  }
}

export async function parseSpiirZipAccounts(buf: ArrayBuffer): Promise<SpiirAccount[]> {
  const zip = await JSZip.loadAsync(buf)
  const accountFile = findZipFile(zip, 'Account.csv')
  if (!accountFile) throw new Error('Fant ikke Account.csv i ZIP-filen.')

  const text = stripBom(await accountFile.async('text'))
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const idx = buildHeaderIndex(rows[0])

  const accounts: SpiirAccount[] = []
  for (let i = 1; i < rows.length; i++) {
    const f = rows[i]
    const accountId = f[idx['Id']]
    if (!accountId) continue
    const bankId = f[idx['BankId']] || ''
    const { iban, bban } = parseAccountNumber(f[idx['AccountNumber']] || '')
    accounts.push({
      accountId,
      name: f[idx['Name']] || accountId,
      currency: f[idx['Currency']] || 'NOK',
      bankName: bankId ? bankIdToName(bankId) : undefined,
      iban: iban || undefined,
      bban: bban || undefined,
    })
  }
  return accounts
}

export async function buildImportPayloadFromZip(
  buf: ArrayBuffer,
  accountMap: Record<string, string>,
): Promise<{ accounts: Account[]; transactions: Transaction[] }> {
  const zip = await JSZip.loadAsync(buf)

  const accountFile = findZipFile(zip, 'Account.csv')
  if (!accountFile) throw new Error('Fant ikke Account.csv i ZIP-filen.')
  const postingFile = findZipFile(zip, 'Posting.csv')
  if (!postingFile) throw new Error('Fant ikke Posting.csv i ZIP-filen.')

  // Build account info lookup keyed by numeric Spiir account Id
  const accountInfoRows = parseCsvRows(stripBom(await accountFile.async('text')))
  const aIdx = buildHeaderIndex(accountInfoRows[0] ?? [])
  const accountInfo: Record<string, { name: string; bankName?: string; iban?: string; bban?: string; currency: string }> = {}
  for (let i = 1; i < accountInfoRows.length; i++) {
    const f = accountInfoRows[i]
    const id = f[aIdx['Id']]
    if (!id) continue
    const { iban, bban } = parseAccountNumber(f[aIdx['AccountNumber']] || '')
    const bankId = f[aIdx['BankId']] || ''
    accountInfo[id] = {
      name: f[aIdx['Name']] || id,
      bankName: bankId ? bankIdToName(bankId) : undefined,
      iban: iban || undefined,
      bban: bban || undefined,
      currency: f[aIdx['Currency']] || 'NOK',
    }
  }

  const postingRows = parseCsvRows(stripBom(await postingFile.async('text')))
  if (postingRows.length < 2) return { accounts: [], transactions: [] }
  const pIdx = buildHeaderIndex(postingRows[0])

  // Resolve sentinel values to fresh UUIDs before processing rows
  const resolvedUids: Record<string, string> = {}
  const createSet = new Set<string>()
  for (const [spiirId, mapped] of Object.entries(accountMap)) {
    if (mapped.startsWith('spiir::')) {
      resolvedUids[spiirId] = crypto.randomUUID()
      createSet.add(spiirId)
    } else {
      resolvedUids[spiirId] = mapped
    }
  }

  const accountsById: Record<string, Account> = {}
  const transactions: Transaction[] = []
  const now = Date.now()

  for (let i = 1; i < postingRows.length; i++) {
    const f = postingRows[i]

    if (f[pIdx['IsAccountGroupDuplicate']] === 'True') continue

    const spiirAccountId = f[pIdx['AccountId']]
    const postingId = f[pIdx['Id']]
    const amountRaw = f[pIdx['Amount']]
    if (!spiirAccountId || !postingId || !amountRaw) continue

    const amount = parseAmount(amountRaw)
    if (amount === 0 || isNaN(amount)) continue

    if (!resolvedUids[spiirAccountId]) {
      resolvedUids[spiirAccountId] = crypto.randomUUID()
      createSet.add(spiirAccountId)
    }
    const targetUid = resolvedUids[spiirAccountId]
    const info = accountInfo[spiirAccountId]
    const currency = f[pIdx['Currency']] || info?.currency || 'NOK'

    if (createSet.has(spiirAccountId) && !accountsById[targetUid]) {
      accountsById[targetUid] = {
        uid: targetUid,
        name: info?.name ?? spiirAccountId,
        bankName: info?.bankName ?? 'Spiir',
        iban: info?.iban,
        bban: info?.bban,
        currency,
        sources: [{ type: 'spiir', sourceId: spiirAccountId }],
        addedAt: now,
      }
    }

    // Date is ISO 8601: "2019-09-23T00:00:00.0000000Z" → "2019-09-23"
    const dateRaw = f[pIdx['Date']]
    const bookingDate = dateRaw ? dateRaw.slice(0, 10) : undefined

    const categoryIdRaw = f[pIdx['SubcategoryId']]
    const parsedCategoryId = categoryIdRaw ? parseInt(categoryIdRaw, 10) : NaN

    const stateRaw = f[pIdx['State']] || ''
    const status = stateRaw === 'Booked' ? 'BOOK' : 'PDNG'

    const entryReference = postingId
    const id = `${targetUid}::${entryReference}`

    const tx: Transaction = {
      id,
      accountUid: targetUid,
      entryReference,
      bookingDate,
      amount,
      currency,
      creditDebit: amount > 0 ? 'CRDT' : 'DBIT',
      description: f[pIdx['Description']] || '',
      status,
      raw: {
        originalDescription: f[pIdx['OriginalDescription']],
        balance: f[pIdx['Balance']],
        comment: f[pIdx['Comment']],
        accountName: info?.name,
      },
    }
    tx.categoryId = mapSpiirCategory(!isNaN(parsedCategoryId) ? parsedCategoryId : undefined) ?? guessCategory(tx)
    transactions.push(tx)
  }

  return { accounts: Object.values(accountsById), transactions }
}
