"use client";

import { AppIcon } from "@/components/app-icon";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "indica-ai-theme";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  function toggleTheme() {
    const nextTheme: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Alternar tema claro ou escuro"
      title="Alternar tema"
      className={`flex items-center rounded-xl border bg-(--surface-muted) text-sm transition ${
        showLabel ? "h-11 w-full justify-between gap-3 px-3.5" : "size-10 justify-center"
      }`}
    >
      {showLabel ? <span className="font-medium">Tema</span> : null}
      <span className="flex items-center gap-2">
        <AppIcon name="moon" className="size-4.5 dark:hidden" />
        <AppIcon name="sun" className="hidden size-4.5 dark:block" />
        {showLabel ? (
          <span aria-hidden className="relative h-5 w-9 rounded-full bg-(--border)">
            <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-(--muted) transition-all dark:translate-x-4 dark:bg-(--accent-strong)" />
          </span>
        ) : null}
      </span>
    </button>
  );
}
