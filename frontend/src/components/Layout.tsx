import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoonIcon, SunIcon } from "./ui/icons";

const nav = [
  { to: "/dashboard", label: "Oversikt" },
  { to: "/settings", label: "Innstillinger" },
];

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "dark";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const showNav = pathname !== "/setup" && pathname !== "/connect";
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.add("theme-switching");
    document.documentElement.classList.toggle("light", next === "light");
    localStorage.setItem("theme", next);
    setTheme(next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.documentElement.classList.remove("theme-switching")),
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {showNav && (
        <header className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src="/favicon.svg" alt="Lommin" className="h-7 w-auto" />
              <span className="mono text-base font-semibold text-text tracking-tight">
                lommin<span className="text-accent">.</span>
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <nav className="flex items-center gap-1">
                {nav.map(({ to, label }) => (
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
              <button
                onClick={toggle}
                className="ml-1 p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-4">
          <Link to="/privacy" className="text-xs text-muted hover:text-text transition-colors">
            Personvern
          </Link>
          <span className="text-border">·</span>
          <Link to="/terms" className="text-xs text-muted hover:text-text transition-colors">
            Vilkår
          </Link>
        </div>
      </footer>
    </div>
  );
}
