import { useState, useEffect } from "preact/hooks";
import { Moon, Sun } from "lucide-preact";

type Theme = "dark" | "light";

const STORAGE_KEY = "vibecoded-theme";

function getStoredTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  const s = localStorage.getItem(STORAGE_KEY);
  if (s === "dark" || s === "light") return s;
  return null;
}

function getSystemTheme(): Theme {
  const w = typeof globalThis !== "undefined" ? (globalThis as Window) : null;
  if (!w?.matchMedia) return "dark";
  return w.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    () => getStoredTheme() ?? getSystemTheme()
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      class="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-vibe-elevated border border-vibe-border text-vibe-fg hover:bg-vibe-border/50 active:scale-[0.98] transition-all touch-manipulation"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun size={20} strokeWidth={2} />
      ) : (
        <Moon size={20} strokeWidth={2} />
      )}
    </button>
  );
}
