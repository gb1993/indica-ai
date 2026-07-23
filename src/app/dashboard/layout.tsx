import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "./actions";
import { ThemeToggle } from "./theme-toggle";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, avatar_url")
    .eq("id", authData.user.id)
    .single();

  const name = profile?.name ?? authData.user.email?.split("@")[0] ?? "Usuário";
  const email = profile?.email ?? authData.user.email ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-3 font-bold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-black text-[#07150c]">AÍ</span>
            <span>Indica Aí</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-1.5 pr-3 transition hover:bg-[var(--surface-muted)]">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-[var(--accent)] text-sm font-bold text-[#07150c]">{initial}</span>
                )}
                <span className="hidden max-w-32 truncate text-sm sm:block">{name}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-[var(--surface)] p-2 shadow-xl shadow-black/20">
                <div className="border-b px-3 py-2">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{email}</p>
                </div>
                <form action={logout} className="mt-2">
                  <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-muted)]">Sair</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
