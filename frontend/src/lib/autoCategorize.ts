import type { Transaction } from "./store";

const BTC_RULES: Array<[string | RegExp, number]> = [
  // Food & drink — specific first
  ["FAST FOOD", 143],
  ["EATING PLACES", 144],
  ["RESTAURANTS", 144],
  ["DRINKING PLACES", 144],
  ["BARS/TAVERNS", 144],

  // Groceries / kiosk
  ["GROCERY STORES", 126],
  ["SUPERMARKETS", 126],
  ["MISC FOOD STORES", 126],
  ["NEWS DEALERS", 127],
  ["CANDY", 127],

  // Pharmacy
  ["DRUG STORES", 134],
  ["PHARMACIES", 134],

  // Transport
  ["TAXICABS", 122],
  ["LIMOUSINES", 122],
  ["LOCAL COMMUTER TRANSPORT", 121],
  ["BUS LINES", 121],
  ["CHARTER", 121],
  ["SERVICE STATIONS", 118],
  ["TRANSPORTATION SVCS", 125],

  // Travel
  [/AIR SHUTTLE|AIRLINES?/i, 130],
  ["NORWEGIAN AIR", 130],
  ["HOTELS", 130],
  ["LODGING", 130],
  ["TOURIST ATTRACTIONS", 133],
  ["DUTY FREE", 158],

  // Digital goods — specific before generic (en-dash U+2013)
  ["DIGITAL GOODS – GAMES", 148],
  ["DIGITAL GOODS – GAMES", 148],
  ["DIGITAL GOODS – MEDIA", 151],
  ["DIGITAL GOODS MEDIA", 151],
  ["DIGITAL GOODS", 157],

  // Tech / software
  ["COMPUTER SOFTWARE", 157],
  ["COMPUTER NETWORK", 157],

  // Clothing
  ["CLOTHING STORES", 145],
  ["FAMILY CLOTHING", 145],
  ["APPAREL", 145],

  // Electronics
  ["HOUSEHOLD APPLIANCE", 147],

  // Sports
  ["SPORTING GOODS", 142],
  ["COMMERCIAL SPORTS", 142],
  ["ATHLETIC", 142],

  // Beauty / personal care
  ["BEAUTY", 150],
  ["BARBER", 150],

  // Culture / entertainment
  ["ART DEALERS", 152],
  ["GALLERIES", 152],

  // Charity
  ["CHARITABLE", 155],
  ["SOC SERVICE ORGS", 155],

  // Government
  ["GOV'T SERV", 164],

  // Misc shopping
  ["DEPARTMENT STORES", 156],
  ["USED MERCHANDISE", 156],
];

const CREDITOR_RULES: Array<[RegExp, number]> = [
  [/\bBOLT\b/i, 122],
  [/\bRUTER\b/i, 121],
  [/Vipps\*Norweg/i, 130],
  [/\bFLYTOGET\b/i, 121],
  [/\bENTUR\b/i, 121],
  [/STEAMGAMES|STEAM/i, 148],
  [/NETFLIX/i, 151],
  [/SPOTIFY/i, 151],
  [/Vipps\*GOOGLE|PAYPAL.*GOOGLE/i, 157],
  [/HETZNER|NORDHOST/i, 157],
  [/\bOBOS\b/i, 111],
];

const DESCRIPTION_RULES: Array<[RegExp, number]> = [
  [/\b(kiwi|rema\s*1000|coop|meny|spar|extra|holdbart)\b/i, 126],
  [/\b(narvesen|7.eleven|7eleven|press)\b/i, 127],
  [/\b(vitusapotek|apotek1?|boots apotek)\b/i, 134],
  [/\b(kanpla|compass)\b/i, 143],
];

export function guessCategory(
  tx: Transaction,
  creditorHistory?: Map<string, number>,
): number | undefined {
  const creditorName = (tx.raw.creditor as Record<string, unknown> | undefined)
    ?.name as string | undefined;

  // --- CRDT short-circuit ---
  if (tx.creditDebit === "CRDT") {
    const desc = tx.description.toLowerCase();
    if (desc.includes("cashback transfer") || desc.includes("innbetaling"))
      return 108;
    return undefined;
  }

  // --- Step 0: user's own history for this creditor ---
  if (creditorName && creditorHistory?.has(creditorName)) {
    return creditorHistory.get(creditorName)!;
  }

  // --- Step 1: BTC description ---
  const btcDesc = (
    tx.raw.bank_transaction_code as Record<string, unknown> | undefined
  )?.description as string | undefined;

  if (btcDesc) {
    const normalized = btcDesc.toUpperCase();
    // Skip ambiguous code — mostly Vipps private transfers
    if (normalized.includes("FINANCIAL INST")) return undefined;

    for (const [pattern, catId] of BTC_RULES) {
      if (typeof pattern === "string") {
        if (normalized.includes(pattern)) return catId;
      } else {
        if (pattern.test(btcDesc)) return catId;
      }
    }
  }

  // --- Step 2: creditor name patterns ---
  if (creditorName) {
    for (const [pattern, catId] of CREDITOR_RULES) {
      if (pattern.test(creditorName)) return catId;
    }
  }

  // --- Step 3: remittance/description fallback ---
  if (tx.description) {
    for (const [pattern, catId] of DESCRIPTION_RULES) {
      if (pattern.test(tx.description)) return catId;
    }
  }

  return undefined;
}
