import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faEyeSlash, faArrowRightArrowLeft, faUserGroup,
  faWallet, faBriefcase, faReceipt, faPercent, faChartColumn,
  faArrowRotateLeft, faUmbrella, faSun, faChildReaching,
  faHouseChimneyUser, faGraduationCap, faCoins,
  faHouseChimney, faHouse, faBolt, faBuilding, faShieldHalved,
  faLock, faLandmark, faTree, faHammer, faSeedling, faCouch,
  faCar, faGasPump, faShield, faFileInvoiceDollar, faBus,
  faTaxi, faSquareParking, faScrewdriverWrench, faBicycle,
  faCartShopping, faStore, faBox, faUtensils,
  faPlane, faCarSide, faTent, faMap,
  faCalendarCheck, faPills, faFileContract, faHeartPulse,
  faHospital, faTv, faMobileScreenButton, faStethoscope,
  faGlasses, faBook, faSchool, faPeopleArrows, faIdCard,
  faFaceSmile, faPersonRunning, faBurger, faShirt, faLaptop,
  faGamepad, faPalette, faScissors, faMusic, faTicket, faDice,
  faPaw, faGift, faGlobe, faWineGlass, faUserTie,
  faMoneyBillWave, faBagShopping,
  faFolder, faQuestion, faBuildingColumns, faScaleBalanced,
  faChartLine,
  faCreditCard, faHandshake, faArrowTrendDown,
  faPiggyBank, faBaby,
} from "@fortawesome/free-solid-svg-icons";

export const CATEGORY_ICONS: Record<number, IconDefinition> = {
  // ── Skjul ──────────────────────────────────────────────
  10:  faEyeSlash,
  100: faArrowRightArrowLeft,
  101: faUserGroup,
  102: faEyeSlash,

  // ── Inntekt ────────────────────────────────────────────
  11:  faWallet,
  103: faBriefcase,
  104: faReceipt,
  105: faPercent,
  106: faChartColumn,
  107: faArrowRotateLeft,
  108: faUmbrella,
  109: faSun,
  110: faChildReaching,
  111: faHouseChimneyUser,
  112: faGraduationCap,
  113: faCoins,

  // ── Bolig ──────────────────────────────────────────────
  12:  faHouseChimney,
  114: faHouse,
  115: faBolt,
  116: faBuilding,
  117: faShieldHalved,
  118: faLock,
  119: faLandmark,
  120: faTree,
  121: faHammer,
  122: faSeedling,
  123: faCouch,

  // ── Bil & Transport ────────────────────────────────────
  13:  faCar,
  124: faCar,
  125: faGasPump,
  126: faShield,
  127: faFileInvoiceDollar,
  128: faBus,
  129: faTaxi,
  130: faSquareParking,
  131: faScrewdriverWrench,
  132: faBicycle,

  // ── Dagligvarer & Mat ──────────────────────────────────
  14:  faCartShopping,
  133: faCartShopping,
  134: faStore,
  135: faBox,
  136: faUtensils,

  // ── Reise ──────────────────────────────────────────────
  15:  faPlane,
  137: faPlane,
  138: faCarSide,
  139: faTent,
  140: faMap,
  141: faShield,

  // ── Faste utgifter ─────────────────────────────────────
  16:  faCalendarCheck,
  142: faPills,
  143: faFileContract,
  144: faHeartPulse,
  145: faHospital,
  146: faTv,
  147: faMobileScreenButton,
  148: faStethoscope,
  149: faGlasses,
  150: faBook,
  151: faSchool,
  152: faPeopleArrows,
  153: faIdCard,

  // ── Fritid ─────────────────────────────────────────────
  17:  faFaceSmile,
  154: faPersonRunning,
  155: faBurger,
  156: faUtensils,
  157: faShirt,
  158: faCouch,
  159: faLaptop,
  160: faGamepad,
  161: faPalette,
  162: faScissors,
  163: faMusic,
  164: faTicket,
  165: faDice,
  166: faPaw,
  167: faGift,
  168: faGlobe,
  169: faWineGlass,
  170: faUserTie,
  171: faMoneyBillWave,
  172: faBagShopping,

  // ── Annet ──────────────────────────────────────────────
  18:  faFolder,
  173: faQuestion,
  174: faBuildingColumns,
  175: faScaleBalanced,
  176: faChartLine,
  177: faLandmark,

  // ── Gjeld & Renter ─────────────────────────────────────
  19:  faCreditCard,
  178: faGraduationCap,
  179: faCreditCard,
  180: faHandshake,
  181: faArrowTrendDown,

  // ── Pensjon & Sparing ──────────────────────────────────
  20:  faPiggyBank,
  182: faPiggyBank,
  183: faBaby,
  184: faChartLine,
  185: faCoins,
};

export function getCategoryIcon(id: number | undefined): IconDefinition {
  return (id != null ? CATEGORY_ICONS[id] : undefined) ?? faQuestion;
}
