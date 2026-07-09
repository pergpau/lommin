export type CategoryType = "income" | "expense" | "saving" | "exclude";

export interface SubCategory {
  id: number;
  name: string;
  type: CategoryType;
  mainCategoryId: number;
}

export interface MainCategory {
  id: number;
  name: string;
  color: string;
  subCategories: SubCategory[];
}

export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: 10,
    name: "Skjul",
    color: "#6b7280",
    subCategories: [
      { id: 100, name: "Overføring", type: "exclude", mainCategoryId: 10 },
      { id: 101, name: "Delt utgift", type: "exclude", mainCategoryId: 10 },
      { id: 102, name: "Skjul", type: "exclude", mainCategoryId: 10 },
    ],
  },
  {
    id: 11,
    name: "Inntekt",
    color: "#16a34a",
    subCategories: [
      { id: 103, name: "Lønn", type: "income", mainCategoryId: 11 },
      { id: 104, name: "Dagpenger", type: "income", mainCategoryId: 11 },
      { id: 105, name: "Renteinntekter", type: "income", mainCategoryId: 11 },
      { id: 106, name: "Avkastning & Utbytte", type: "income", mainCategoryId: 11 },
      { id: 107, name: "Tilbakebetalt skatt", type: "income", mainCategoryId: 11 },
      { id: 108, name: "Pensjonsinntekt", type: "income", mainCategoryId: 11 },
      { id: 109, name: "Feriepenger", type: "income", mainCategoryId: 11 },
      { id: 110, name: "Barnetrygd", type: "income", mainCategoryId: 11 },
      { id: 111, name: "Bostøtte", type: "income", mainCategoryId: 11 },
      { id: 112, name: "Studielån / Stipend", type: "income", mainCategoryId: 11 },
      { id: 113, name: "Andre inntekter", type: "income", mainCategoryId: 11 },
    ],
  },
  {
    id: 20,
    name: "Pensjon & Sparing",
    color: "#8b3eb8",
    subCategories: [
      { id: 182, name: "Pensjonssparing", type: "saving", mainCategoryId: 20 },
      { id: 183, name: "Barnesparing", type: "saving", mainCategoryId: 20 },
      { id: 184, name: "Verdipapirhandel", type: "saving", mainCategoryId: 20 },
      { id: 185, name: "Annen sparing", type: "saving", mainCategoryId: 20 },
    ],
  },
  {
    id: 12,
    name: "Bolig",
    color: "#7c3d12",
    subCategories: [
      { id: 114, name: "Lån/Husleie", type: "expense", mainCategoryId: 12 },
      { id: 115, name: "Strøm & Energi", type: "expense", mainCategoryId: 12 },
      { id: 116, name: "Felleskostnader", type: "expense", mainCategoryId: 12 },
      { id: 117, name: "Bygningsforsikring", type: "expense", mainCategoryId: 12 },
      { id: 118, name: "Innboforsikring", type: "expense", mainCategoryId: 12 },
      { id: 119, name: "Eiendomsskatt", type: "expense", mainCategoryId: 12 },
      { id: 120, name: "Hytte & Fritidshus", type: "expense", mainCategoryId: 12 },
      { id: 121, name: "Oppussing & Reparasjon", type: "expense", mainCategoryId: 12 },
      { id: 122, name: "Hage & Planter", type: "expense", mainCategoryId: 12 },
      { id: 123, name: "Andre boutgifter", type: "expense", mainCategoryId: 12 },
    ],
  },
  {
    id: 13,
    name: "Bil & Transport",
    color: "#1d4ed8",
    subCategories: [
      { id: 124, name: "Billån m.m.", type: "expense", mainCategoryId: 13 },
      { id: 125, name: "Drivstoff", type: "expense", mainCategoryId: 13 },
      { id: 126, name: "Bilforsikring & Assistanse", type: "expense", mainCategoryId: 13 },
      { id: 127, name: "Årsavgift & Engangsavgift", type: "expense", mainCategoryId: 13 },
      { id: 128, name: "Kollektivtransport", type: "expense", mainCategoryId: 13 },
      { id: 129, name: "Taxi", type: "expense", mainCategoryId: 13 },
      { id: 130, name: "Parkering", type: "expense", mainCategoryId: 13 },
      { id: 131, name: "Garasje & Bildeler", type: "expense", mainCategoryId: 13 },
      { id: 132, name: "Annen transport", type: "expense", mainCategoryId: 13 },
    ],
  },
  {
    id: 14,
    name: "Dagligvarer & Mat",
    color: "#eab308",
    subCategories: [
      { id: 133, name: "Dagligvarer", type: "expense", mainCategoryId: 14 },
      { id: 134, name: "Kiosk & Delikatesser", type: "expense", mainCategoryId: 14 },
      { id: 135, name: "Matkasse", type: "expense", mainCategoryId: 14 },
      { id: 136, name: "Kantine", type: "expense", mainCategoryId: 14 },
    ],
  },
  {
    id: 15,
    name: "Reise",
    color: "#ea580c",
    subCategories: [
      { id: 137, name: "Fly & Hotell", type: "expense", mainCategoryId: 15 },
      { id: 138, name: "Leiebil", type: "expense", mainCategoryId: 15 },
      { id: 139, name: "Feriehus & Camping", type: "expense", mainCategoryId: 15 },
      { id: 140, name: "Ferieaktiviteter", type: "expense", mainCategoryId: 15 },
      { id: 141, name: "Reiseforsikring", type: "expense", mainCategoryId: 15 },
    ],
  },
  {
    id: 16,
    name: "Basisutgifter",
    color: "#7c3aed",
    subCategories: [
      { id: 142, name: "Apotek", type: "expense", mainCategoryId: 16 },
      { id: 143, name: "Fagforening", type: "expense", mainCategoryId: 16 },
      { id: 144, name: "Livsforsikring", type: "expense", mainCategoryId: 16 },
      { id: 145, name: "Helseforsikring", type: "expense", mainCategoryId: 16 },
      { id: 146, name: "TV & Strømming", type: "expense", mainCategoryId: 16 },
      { id: 147, name: "Telefon & Internett", type: "expense", mainCategoryId: 16 },
      { id: 148, name: "Lege", type: "expense", mainCategoryId: 16 },
      { id: 149, name: "Briller & Linser", type: "expense", mainCategoryId: 16 },
      { id: 150, name: "Utdanning", type: "expense", mainCategoryId: 16 },
      { id: 151, name: "Barnehage & SFO", type: "expense", mainCategoryId: 16 },
      { id: 152, name: "Underholdsbidrag", type: "expense", mainCategoryId: 16 },
      { id: 153, name: "Medlemskap", type: "expense", mainCategoryId: 16 },
    ],
  },
  {
    id: 17,
    name: "Fritid",
    color: "#db2777",
    subCategories: [
      { id: 154, name: "Sport & Fritid", type: "expense", mainCategoryId: 17 },
      { id: 155, name: "Fast Food & Take Away", type: "expense", mainCategoryId: 17 },
      { id: 156, name: "Restaurant & Bar", type: "expense", mainCategoryId: 17 },
      { id: 157, name: "Klær & Accessoarer", type: "expense", mainCategoryId: 17 },
      { id: 158, name: "Møbler & Interiør", type: "expense", mainCategoryId: 17 },
      { id: 159, name: "Elektronikk & Data", type: "expense", mainCategoryId: 17 },
      { id: 160, name: "Spill & Leketøy", type: "expense", mainCategoryId: 17 },
      { id: 161, name: "Hobby & Sportsutstyr", type: "expense", mainCategoryId: 17 },
      { id: 162, name: "Frisør & Personlig pleie", type: "expense", mainCategoryId: 17 },
      { id: 163, name: "Film, Musikk & Bøker", type: "expense", mainCategoryId: 17 },
      { id: 164, name: "Kino, Konserter & Underholdning", type: "expense", mainCategoryId: 17 },
      { id: 165, name: "Spill & Odds", type: "expense", mainCategoryId: 17 },
      { id: 166, name: "Kjæledyr", type: "expense", mainCategoryId: 17 },
      { id: 167, name: "Gaver & Veldedighet", type: "expense", mainCategoryId: 17 },
      { id: 168, name: "Nettjenester & Programvare", type: "expense", mainCategoryId: 17 },
      { id: 169, name: "Tobakk & Alkohol", type: "expense", mainCategoryId: 17 },
      { id: 170, name: "Rådgivere & Tjenester", type: "expense", mainCategoryId: 17 },
      { id: 171, name: "Kontantuttak", type: "expense", mainCategoryId: 17 },
      { id: 172, name: "Annet privat forbruk", type: "expense", mainCategoryId: 17 },
    ],
  },
  {
    id: 18,
    name: "Annet",
    color: "#475569",
    subCategories: [
      { id: 173, name: "Ukjent", type: "expense", mainCategoryId: 18 },
      { id: 174, name: "Bankgebyrer", type: "expense", mainCategoryId: 18 },
      { id: 175, name: "Bøter", type: "expense", mainCategoryId: 18 },
      { id: 176, name: "Restskatt", type: "expense", mainCategoryId: 18 },
      { id: 177, name: "Offentlig gebyr", type: "expense", mainCategoryId: 18 },
    ],
  },
  {
    id: 19,
    name: "Gjeld & Renter",
    color: "#dc2626",
    subCategories: [
      { id: 178, name: "Studielån", type: "expense", mainCategoryId: 19 },
      { id: 179, name: "Forbrukslån", type: "expense", mainCategoryId: 19 },
      { id: 180, name: "Privatlån", type: "expense", mainCategoryId: 19 },
      { id: 181, name: "Renter", type: "expense", mainCategoryId: 19 },
    ],
  },
];

export const SUB_CATEGORY_MAP: Record<number, SubCategory> = Object.fromEntries(
  MAIN_CATEGORIES.flatMap((m) => m.subCategories.map((s) => [s.id, s])),
);

export const MAIN_CATEGORY_MAP: Record<number, MainCategory> = Object.fromEntries(
  MAIN_CATEGORIES.map((m) => [m.id, m]),
);

export const TYPE_LABELS: Record<CategoryType, string> = {
  income: "Inntekt",
  expense: "Utgift",
  saving: "Sparing",
  exclude: "Ekskludert",
};
