import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "../lib/demoData";
import { MoonIcon, SunIcon } from "./ui/icons";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "light";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation("nav");
  const showNav = pathname !== "/setup" && pathname !== "/onboarding";
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [isDemo, setIsDemo] = useState(false);

  const currentLang = i18n.language === "en" ? "en" : "nb";

  const nav = [
    { to: "/dashboard", label: t("items.overview") },
    { to: "/settings", label: t("items.settings") },
  ];

  useEffect(() => {
    if (showNav) isDemoMode().then(setIsDemo);
  }, [showNav]);

  function toggle() {
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
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="mono text-xl font-semibold text-text tracking-tight">
              lommin<span className="text-accent">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {showNav && (
              <nav className="flex items-center gap-1">
                {nav.filter(({ to }) => !(isDemo && to === "/settings")).map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      pathname.startsWith(to)
                        ? "text-text bg-surface-2"
                        : "text-muted hover:text-text hover:bg-surface-2"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            <button
              onClick={toggleLanguage}
              className="ml-1 px-2 py-1 rounded text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
              aria-label={t("languageSwitcher.ariaLabel")}
            >
              {currentLang === "nb" ? "EN" : "NB"}
            </button>
            <button
              onClick={toggle}
              className="ml-1 p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
              aria-label={theme === "dark" ? t("themeToggle.toLight") : t("themeToggle.toDark")}
            >
              {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-4">
          <Link to="/privacy" className="text-xs text-muted hover:text-text transition-colors">
            {t("footer.privacy")}
          </Link>
          <span className="text-border">·</span>
          <Link to="/terms" className="text-xs text-muted hover:text-text transition-colors">
            {t("footer.terms")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
