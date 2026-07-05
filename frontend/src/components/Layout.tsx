import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartColumn, faGear } from "@fortawesome/free-solid-svg-icons";
import { isDemoMode } from "../lib/demoData";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useTranslation("nav");
  const showNav = pathname !== "/setup" && pathname !== "/onboarding";
  const [isDemo, setIsDemo] = useState(false);

  const nav = [
    { to: "/dashboard", label: t("items.overview"), icon: faChartColumn },
    { to: "/settings", label: t("items.settings"), icon: faGear },
  ];

  useEffect(() => {
    if (showNav) isDemoMode().then(setIsDemo);
  }, [showNav]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="Lommin" className="h-10 w-auto" />
          </Link>
          {showNav && (
            <nav className="flex items-center gap-1">
              {nav
                .filter(({ to }) => !(isDemo && to === "/settings"))
                .map(({ to, label, icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      pathname.startsWith(to)
                        ? "text-text bg-surface-2"
                        : "text-muted hover:text-text hover:bg-surface-2"
                    }`}
                  >
                    <FontAwesomeIcon icon={icon} />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                ))}
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="border-t border-border py-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-4">
          <Link to="/privacy" className="text-xs text-muted hover:text-text transition-colors">
            {t("footer.privacy")}
          </Link>
          <span className="text-border">·</span>
          <Link to="/terms" className="text-xs text-muted hover:text-text transition-colors">
            {t("footer.terms")}
          </Link>
          <span className="text-border">·</span>
          <a
            href="https://github.com/pergpau/lommin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted hover:text-text transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
