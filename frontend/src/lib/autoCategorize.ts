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

interface RuleSet {
  rules: ReadonlyArray<readonly [string | RegExp, number]>;
  matches: (pattern: string | RegExp, tx: Transaction) => boolean;
}

interface RuleMatch {
  ruleSet: RuleSet;
  pattern: string | RegExp;
  categoryId: number;
}

const RULE_SETS: readonly RuleSet[] = [
  {
    rules: BTC_RULES,
    matches: (pattern, tx) => {
      if (!tx.bankTransactionCode) return false;
      return typeof pattern === "string"
        ? tx.bankTransactionCode.toUpperCase().includes(pattern)
        : pattern.test(tx.bankTransactionCode);
    },
  },
  {
    rules: CREDITOR_RULES,
    matches: (pattern, tx) => !!tx.creditorName && (pattern as RegExp).test(tx.creditorName),
  },
  {
    rules: DESCRIPTION_RULES,
    matches: (pattern, tx) => !!tx.description && (pattern as RegExp).test(tx.description),
  },
];

function matchRules(tx: Transaction): RuleMatch | null {
  if (tx.bankTransactionCode?.toUpperCase().includes("FINANCIAL INST")) return null;

  for (const ruleSet of RULE_SETS) {
    for (const [pattern, categoryId] of ruleSet.rules) {
      if (ruleSet.matches(pattern, tx)) return { ruleSet, pattern, categoryId };
    }
  }

  return null;
}

function resolveCategory(
  tx: Transaction,
  creditorHistory?: Map<string, number>,
  bbanHistory?: Map<string, number>,
): number | undefined {
  if (tx.creditDebit === "CRDT") {
    const desc = tx.description.toLowerCase();
    if (desc.includes("cashback transfer") || desc.includes("innbetaling")) return 113;
    return undefined;
  }

  if (tx.creditorName && creditorHistory?.has(tx.creditorName)) {
    return creditorHistory.get(tx.creditorName)!;
  }

  const key = bbanKey(tx);
  if (key && bbanHistory?.has(key)) {
    return bbanHistory.get(key)!;
  }

  return matchRules(tx)?.categoryId;
}

export function findMatchingRulePredicate(tx: Transaction): ((t: Transaction) => boolean) | null {
  const match = matchRules(tx);
  if (!match) return null;

  return (t) => match.ruleSet.matches(match.pattern, t);
}

export function guessCategory(
  tx: Transaction,
  creditorHistory?: Map<string, number>,
  bbanHistory?: Map<string, number>,
): number | undefined {
  const id = resolveCategory(tx, creditorHistory, bbanHistory);
  return id !== undefined && SUB_CATEGORY_MAP[id]?.type === "exclude" ? undefined : id;
}
