"use client";

import { useOptimistic } from "react";

import { updateTheme } from "./actions";

export function ThemeToggle({ theme }: { theme: "dark" | "light" }) {
  const [optimisticTheme, setOptimisticTheme] = useOptimistic(theme);
  const nextTheme = optimisticTheme === "dark" ? "light" : "dark";

  return (
    <form
      action={async (formData) => {
        setOptimisticTheme(nextTheme);
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        await updateTheme(formData);
      }}
    >
      <input type="hidden" name="theme" value={nextTheme} />
      <button
        type="submit"
        aria-label={`Usar tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
        title={`Usar tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
        className="grid size-10 place-items-center rounded-xl border bg-[var(--surface-muted)] text-lg transition"
      >
        <span aria-hidden="true">{optimisticTheme === "dark" ? "☀" : "☾"}</span>
      </button>
    </form>
  );
}
