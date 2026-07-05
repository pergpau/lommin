import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import nbCommon from "../locales/nb/common.json";
import nbNav from "../locales/nb/nav.json";
import nbDashboard from "../locales/nb/dashboard.json";
import nbAccount from "../locales/nb/account.json";
import nbSettings from "../locales/nb/settings.json";
import nbOnboarding from "../locales/nb/onboarding.json";
import nbConnect from "../locales/nb/connect.json";
import nbComponents from "../locales/nb/components.json";
import nbTransactions from "../locales/nb/transactions.json";
import nbCategories from "../locales/nb/categories.json";
import nbCharts from "../locales/nb/charts.json";
import nbPrivacyTerms from "../locales/nb/privacyTerms.json";

import enCommon from "../locales/en/common.json";
import enNav from "../locales/en/nav.json";
import enDashboard from "../locales/en/dashboard.json";
import enAccount from "../locales/en/account.json";
import enSettings from "../locales/en/settings.json";
import enOnboarding from "../locales/en/onboarding.json";
import enConnect from "../locales/en/connect.json";
import enComponents from "../locales/en/components.json";
import enTransactions from "../locales/en/transactions.json";
import enCategories from "../locales/en/categories.json";
import enCharts from "../locales/en/charts.json";
import enPrivacyTerms from "../locales/en/privacyTerms.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      nb: {
        common: nbCommon,
        nav: nbNav,
        dashboard: nbDashboard,
        account: nbAccount,
        settings: nbSettings,
        onboarding: nbOnboarding,
        connect: nbConnect,
        components: nbComponents,
        transactions: nbTransactions,
        categories: nbCategories,
        charts: nbCharts,
        privacyTerms: nbPrivacyTerms,
      },
      en: {
        common: enCommon,
        nav: enNav,
        dashboard: enDashboard,
        account: enAccount,
        settings: enSettings,
        onboarding: enOnboarding,
        connect: enConnect,
        components: enComponents,
        transactions: enTransactions,
        categories: enCategories,
        charts: enCharts,
        privacyTerms: enPrivacyTerms,
      },
    },
    fallbackLng: "nb",
    defaultNS: "common",
    supportedLngs: ["nb", "en"],
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lommin_language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

export function getLocale(): string {
  return i18n.language === "en" ? "en-GB" : "nb-NO";
}
