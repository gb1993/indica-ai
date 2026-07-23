"use client";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "indica-ai-theme";

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Alternar tema claro ou escuro"
      title="Alternar tema"
      className="grid size-10 place-items-center rounded-xl border bg-(--surface-muted) text-lg transition"
    >
      <span aria-hidden="true" className="dark:hidden">☾</span>
      <span aria-hidden="true" className="hidden dark:inline">☀</span>
    </button>
  );
}
