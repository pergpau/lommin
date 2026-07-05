import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import Card from "../ui/Card";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "light";
}

function segmentClass(active: boolean): string {
  return `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
    active ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
  }`;
}

export default function AppearanceSection() {
  const { t, i18n } = useTranslation("settings");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const currentLang = i18n.language === "en" ? "en" : "nb";

  function applyTheme(next: Theme) {
    if (next === theme) return;
    document.documentElement.classList.add("theme-switching");
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.documentElement.classList.remove("theme-switching")),
    );
  }

  function setLanguage(lang: "nb" | "en") {
    if (lang !== currentLang) void i18n.changeLanguage(lang);
  }

  return (
    <Card className="p-5 mb-4">
      <h2 className="text-sm font-semibold text-text mb-4">{t("appearance.title")}</h2>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text">{t("appearance.theme")}</span>
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => applyTheme("light")}
            className={segmentClass(theme === "light")}
          >
            <FontAwesomeIcon icon={faSun} />
            {t("appearance.light")}
          </button>
          <button
            type="button"
            onClick={() => applyTheme("dark")}
            className={segmentClass(theme === "dark")}
          >
            <FontAwesomeIcon icon={faMoon} />
            {t("appearance.dark")}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-text">{t("appearance.language")}</span>
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setLanguage("nb")}
            className={segmentClass(currentLang === "nb")}
          >
            Norsk
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={segmentClass(currentLang === "en")}
          >
            English
          </button>
        </div>
      </div>
    </Card>
  );
}
