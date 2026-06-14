import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function initTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "dark";
}

export function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  localStorage.setItem("theme", theme);
}

export function useThemeState() {
  const [theme, setTheme] = useState<Theme>(initTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggle };
}
