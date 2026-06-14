export type CategoryType = "income" | "expense" | "saving" | "exclude";

export interface SubCategory {
  id: number;
  name: string;
  type: CategoryType;
  mainCategoryId: number;
  icon: string;
}

export interface MainCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  subCategories: SubCategory[];
}

export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: 10,
    name: "Skjul",
    color: "#6b7280",
    icon: "🚫",
    subCategories: [
      { id: 100, name: "Overføring", type: "exclude", mainCategoryId: 10, icon: "🔄" },
      { id: 101, name: "Delt utgift", type: "exclude", mainCategoryId: 10, icon: "🤝" },
      { id: 102, name: "Ekskluder", type: "exclude", mainCategoryId: 10, icon: "🚫" },
    ],
  },
  {
    id: 11,
    name: "Inntekt",
    color: "#16a34a",
    icon: "💰",
    subCategories: [
      { id: 103, name: "Lønn", type: "income", mainCategoryId: 11, icon: "💼" },
      { id: 104, name: "Dagpenger", type: "income", mainCategoryId: 11, icon: "📋" },
      { id: 105, name: "Renteinntekter", type: "income", mainCategoryId: 11, icon: "📈" },
      { id: 106, name: "Avkastning & Utbytte", type: "income", mainCategoryId: 11, icon: "💹" },
      { id: 107, name: "Tilbakebetalt skatt", type: "income", mainCategoryId: 11, icon: "🏛️" },
      { id: 108, name: "Andre inntekter", type: "income", mainCategoryId: 11, icon: "💰" },
    ],
  },
  {
    id: 12,
    name: "Bolig",
    color: "#2563eb",
    icon: "🏠",
    subCategories: [
      { id: 109, name: "Lån/Husleie", type: "expense", mainCategoryId: 12, icon: "🏠" },
      { id: 110, name: "Strøm & Energi", type: "expense", mainCategoryId: 12, icon: "⚡" },
      { id: 111, name: "Felleskostnader", type: "expense", mainCategoryId: 12, icon: "🏢" },
      { id: 112, name: "Bygningsforsikring", type: "expense", mainCategoryId: 12, icon: "🛡️" },
      { id: 113, name: "Innboforsikring", type: "expense", mainCategoryId: 12, icon: "🔒" },
      { id: 114, name: "Oppussing & Reparasjon", type: "expense", mainCategoryId: 12, icon: "🔨" },
      { id: 115, name: "Andre boutgifter", type: "expense", mainCategoryId: 12, icon: "🏡" },
      { id: 116, name: "Hage & Planter", type: "expense", mainCategoryId: 12, icon: "🌿" },
    ],
  },
  {
    id: 13,
    name: "Bil & Transport",
    color: "#ea580c",
    icon: "🚗",
    subCategories: [
      { id: 117, name: "Billån m.m.", type: "expense", mainCategoryId: 13, icon: "🚗" },
      { id: 118, name: "Drivstoff", type: "expense", mainCategoryId: 13, icon: "⛽" },
      {
        id: 119,
        name: "Bilforsikring & Assistanse",
        type: "expense",
        mainCategoryId: 13,
        icon: "⚙️",
      },
      {
        id: 120,
        name: "Årsavgift & Engangsavgift",
        type: "expense",
        mainCategoryId: 13,
        icon: "📄",
      },
      { id: 121, name: "Kollektivtransport", type: "expense", mainCategoryId: 13, icon: "🚌" },
      { id: 122, name: "Taxi", type: "expense", mainCategoryId: 13, icon: "🚕" },
      { id: 123, name: "Parkering", type: "expense", mainCategoryId: 13, icon: "🅿️" },
      { id: 124, name: "Garasje & Bildeler", type: "expense", mainCategoryId: 13, icon: "🔧" },
      { id: 125, name: "Annen transport", type: "expense", mainCategoryId: 13, icon: "🚲" },
    ],
  },
  {
    id: 14,
    name: "Dagligvarer & Mat",
    color: "#d97706",
    icon: "🛒",
    subCategories: [
      { id: 126, name: "Dagligvarer", type: "expense", mainCategoryId: 14, icon: "🛒" },
      { id: 127, name: "Kiosk & Delikatesser", type: "expense", mainCategoryId: 14, icon: "🏪" },
      { id: 128, name: "Matkasse", type: "expense", mainCategoryId: 14, icon: "📦" },
      { id: 129, name: "Kantine", type: "expense", mainCategoryId: 14, icon: "🍱" },
    ],
  },
  {
    id: 15,
    name: "Reise",
    color: "#0891b2",
    icon: "✈️",
    subCategories: [
      { id: 130, name: "Fly & Hotell", type: "expense", mainCategoryId: 15, icon: "✈️" },
      { id: 131, name: "Leiebil", type: "expense", mainCategoryId: 15, icon: "🚙" },
      { id: 132, name: "Feriehus & Camping", type: "expense", mainCategoryId: 15, icon: "⛺" },
      { id: 133, name: "Ferieaktiviteter", type: "expense", mainCategoryId: 15, icon: "🗺️" },
    ],
  },
  {
    id: 16,
    name: "Faste utgifter",
    color: "#7c3aed",
    icon: "📅",
    subCategories: [
      { id: 134, name: "Apotek", type: "expense", mainCategoryId: 16, icon: "💊" },
      {
        id: 135,
        name: "Fagforening & Dagpengeforsikring",
        type: "expense",
        mainCategoryId: 16,
        icon: "📝",
      },
      { id: 136, name: "TV & Strømming", type: "expense", mainCategoryId: 16, icon: "📺" },
      { id: 137, name: "Telefon & Internett", type: "expense", mainCategoryId: 16, icon: "📱" },
      { id: 138, name: "Legespesialist", type: "expense", mainCategoryId: 16, icon: "🩺" },
      { id: 139, name: "Briller & Linser", type: "expense", mainCategoryId: 16, icon: "👓" },
      { id: 140, name: "Utdanning", type: "expense", mainCategoryId: 16, icon: "📚" },
      { id: 141, name: "Medlemskap", type: "expense", mainCategoryId: 16, icon: "🎫" },
    ],
  },
  {
    id: 17,
    name: "Fritid",
    color: "#e11d48",
    icon: "🎉",
    subCategories: [
      { id: 142, name: "Sport & Fritid", type: "expense", mainCategoryId: 17, icon: "⚽" },
      { id: 143, name: "Fast Food & Take Away", type: "expense", mainCategoryId: 17, icon: "🍔" },
      { id: 144, name: "Restaurant & Bar", type: "expense", mainCategoryId: 17, icon: "🍽️" },
      { id: 145, name: "Klær & Accessoarer", type: "expense", mainCategoryId: 17, icon: "👗" },
      { id: 146, name: "Møbler & Interiør", type: "expense", mainCategoryId: 17, icon: "🛋️" },
      { id: 147, name: "Elektronikk & Data", type: "expense", mainCategoryId: 17, icon: "💻" },
      { id: 148, name: "Spill & Leketøy", type: "expense", mainCategoryId: 17, icon: "🎮" },
      { id: 149, name: "Hobby & Sportsutstyr", type: "expense", mainCategoryId: 17, icon: "🎨" },
      {
        id: 150,
        name: "Frisør & Personlig pleie",
        type: "expense",
        mainCategoryId: 17,
        icon: "✂️",
      },
      { id: 151, name: "Film, Musikk & Bøker", type: "expense", mainCategoryId: 17, icon: "🎵" },
      {
        id: 152,
        name: "Kino, Konserter & Underholdning",
        type: "expense",
        mainCategoryId: 17,
        icon: "🎬",
      },
      { id: 153, name: "Spill & Odds", type: "expense", mainCategoryId: 17, icon: "🎲" },
      { id: 154, name: "Kjæledyr", type: "expense", mainCategoryId: 17, icon: "🐾" },
      { id: 155, name: "Gaver & Veldedighet", type: "expense", mainCategoryId: 17, icon: "🎁" },
      { id: 156, name: "Annet privat forbruk", type: "expense", mainCategoryId: 17, icon: "🛍️" },
      {
        id: 157,
        name: "Nettjenester & Programvare",
        type: "expense",
        mainCategoryId: 17,
        icon: "🌐",
      },
      { id: 158, name: "Tobakk & Alkohol", type: "expense", mainCategoryId: 17, icon: "🍷" },
      { id: 159, name: "Rådgivere & Tjenester", type: "expense", mainCategoryId: 17, icon: "👔" },
    ],
  },
  {
    id: 18,
    name: "Annet",
    color: "#475569",
    icon: "📂",
    subCategories: [
      { id: 160, name: "Ukjent", type: "expense", mainCategoryId: 18, icon: "❓" },
      { id: 161, name: "Bankgebyrer", type: "expense", mainCategoryId: 18, icon: "🏦" },
      { id: 162, name: "Bøter", type: "expense", mainCategoryId: 18, icon: "⚖️" },
      { id: 163, name: "Restskatt", type: "expense", mainCategoryId: 18, icon: "📊" },
      { id: 164, name: "Offentlig gebyr", type: "expense", mainCategoryId: 18, icon: "🏛️" },
    ],
  },
  {
    id: 19,
    name: "Gjeld & Renter",
    color: "#dc2626",
    icon: "💳",
    subCategories: [
      { id: 165, name: "Studielån", type: "expense", mainCategoryId: 19, icon: "🎓" },
      { id: 166, name: "Forbrukslån", type: "expense", mainCategoryId: 19, icon: "💳" },
      { id: 167, name: "Privatlån", type: "expense", mainCategoryId: 19, icon: "👫" },
      { id: 168, name: "Renter", type: "expense", mainCategoryId: 19, icon: "📉" },
    ],
  },
  {
    id: 20,
    name: "Pensjon & Sparing",
    color: "#059669",
    icon: "🏦",
    subCategories: [
      { id: 169, name: "Annen sparing", type: "saving", mainCategoryId: 20, icon: "🏦" },
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
