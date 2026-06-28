import { SUB_CATEGORY_MAP } from "./categories";
import type { Transaction } from "./types";

const BTC_RULES: Array<[string | RegExp, number]> = [
  // Food & drink — specific first
  ["FAST FOOD", 155],
  ["EATING PLACES", 156],
  ["RESTAURANTS", 156],
  ["DRINKING PLACES", 156],
  ["BARS/TAVERNS", 156],

  // Groceries / kiosk
  ["GROCERY STORES", 133],
  ["SUPERMARKETS", 133],
  ["MISC FOOD STORES", 133],
  ["NEWS DEALERS", 134],
  ["CANDY", 134],

  // Pharmacy
  ["DRUG STORES", 142],
  ["PHARMACIES", 142],

  // Transport
  ["TAXICABS", 129],
  ["LIMOUSINES", 129],
  ["LOCAL COMMUTER TRANSPORT", 128],
  ["BUS LINES", 128],
  ["CHARTER", 128],
  ["SERVICE STATIONS", 125],
  ["TRANSPORTATION SVCS", 132],

  // Travel
  [/AIR SHUTTLE|AIRLINES?/i, 137],
  ["NORWEGIAN AIR", 137],
  ["HOTELS", 137],
  ["LODGING", 137],
  ["TOURIST ATTRACTIONS", 140],
  ["DUTY FREE", 169],

  // Digital goods — specific before generic (en-dash U+2013)
  ["DIGITAL GOODS – GAMES", 160],
  ["DIGITAL GOODS – GAMES", 160],
  ["DIGITAL GOODS – MEDIA", 163],
  ["DIGITAL GOODS MEDIA", 163],
  ["DIGITAL GOODS", 168],

  // Tech / software
  ["COMPUTER SOFTWARE", 168],
  ["COMPUTER NETWORK", 168],

  // Clothing
  ["CLOTHING STORES", 157],
  ["FAMILY CLOTHING", 157],
  ["APPAREL", 157],

  // Electronics
  ["HOUSEHOLD APPLIANCE", 159],

  // Sports
  ["SPORTING GOODS", 154],
  ["COMMERCIAL SPORTS", 154],
  ["ATHLETIC", 154],

  // Beauty / personal care
  ["BEAUTY", 162],
  ["BARBER", 162],

  // Culture / entertainment
  ["ART DEALERS", 164],
  ["GALLERIES", 164],

  // Charity
  ["CHARITABLE", 167],
  ["SOC SERVICE ORGS", 167],

  // Government
  ["GOV'T SERV", 177],

  // Misc shopping
  ["DEPARTMENT STORES", 172],
  ["USED MERCHANDISE", 172],
];

const CREDITOR_RULES: Array<[RegExp, number]> = [
  [/\bBOLT\b/i, 129],
  [/\bRUTER\b/i, 128],
  [/Vipps\*Norweg/i, 137],
  [/\bFLYTOGET\b/i, 128],
  [/\bENTUR\b/i, 128],
  [/STEAMGAMES|STEAM/i, 160],
  [/NETFLIX/i, 163],
  [/SPOTIFY/i, 163],
  [/Vipps\*GOOGLE|PAYPAL.*GOOGLE/i, 168],
  [/HETZNER|NORDHOST/i, 168],
  [/\bOBOS\b/i, 116],
];

const DESCRIPTION_RULES: Array<[RegExp, number]> = [
  [/\b(kiwi|rema\s*1000|coop|meny|spar|extra|holdbart)\b/i, 133],
  [/\b(narvesen|7.eleven|7eleven|press)\b/i, 134],
  [/\b(vitusapotek|apotek1?|boots apotek)\b/i, 142],
  [/\b(kanpla|compass)\b/i, 155],
];

function bbanKey(tx: Transaction): string | undefined {
  if (!tx.to_bban && !tx.from_bban) return undefined;
  return `${tx.from_bban ?? ""}→${tx.to_bban ?? ""}`;
}

function resolveCategory(
  tx: Transaction,
  creditorHistory?: Map<string, number>,
  bbanHistory?: Map<string, number>,
): number | undefined {
  const creditorName = tx.creditorName;

  // --- CRDT short-circuit ---
  if (tx.creditDebit === "CRDT") {
    const desc = tx.description.toLowerCase();
    if (desc.includes("cashback transfer") || desc.includes("innbetaling")) return 113;
    return undefined;
  }

  // --- Step 0: user's own history for this creditor ---
  if (creditorName && creditorHistory?.has(creditorName)) {
    return creditorHistory.get(creditorName)!;
  }

  // --- Step 0b: BBAN pair history ---
  const key = bbanKey(tx);
  if (key && bbanHistory?.has(key)) {
    return bbanHistory.get(key)!;
  }

  // --- Step 1: BTC description ---
  const btcDesc = tx.bankTransactionCode;

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

export function guessCategory(
  tx: Transaction,
  creditorHistory?: Map<string, number>,
  bbanHistory?: Map<string, number>,
): number | undefined {
  const id = resolveCategory(tx, creditorHistory, bbanHistory);
  return id !== undefined && SUB_CATEGORY_MAP[id]?.type === "exclude" ? undefined : id;
}
