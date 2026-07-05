import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "light";
}

/** Compact theme + language switcher, e.g. for the onboarding top bar. */
export default function AppearanceControls() {
  const { i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const currentLang = i18n.language === "en" ? "en" : "nb";

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.add("theme-switching");
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.documentElement.classList.remove("theme-switching")),
    );
  }

  function toggleLanguage() {
    void i18n.changeLanguage(currentLang === "nb" ? "en" : "nb");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
        className="flex items-center justify-center h-8 w-8 text-muted hover:text-text transition-colors"
      >
        <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} />
      </button>
      <button
        type="button"
        onClick={toggleLanguage}
        className="text-sm font-medium text-muted hover:text-text transition-colors px-1"
      >
        {currentLang === "nb" ? "NO" : "EN"}
      </button>
    </div>
  );
}
