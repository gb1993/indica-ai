import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "./actions";
import { ThemeToggle } from "./theme-toggle";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("name, email, avatar_url").eq("id", authData.user.id).single();
  const name = profile?.name ?? authData.user.email?.split("@")[0] ?? "Usuário";
  const email = profile?.email ?? authData.user.email ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-[var(--accent)] px-4 py-2 font-bold text-[#07150c] focus:translate-y-0">Pular para o conteúdo</a>
      <header className="sticky top-0 z-30 border-b bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-5">
          <Link href="/dashboard" className="flex items-center gap-3 font-bold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-black text-[#07150c]">AÍ</span>
            <span className="hidden sm:inline">Indica Aí</span>
          </Link>
          <nav aria-label="Navegação principal" className="ml-auto mr-3 hidden items-center gap-1 sm:flex">
            <Link href="/dashboard" className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]">Grupos</Link>
            <Link href="/app/groups/new" className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]">Criar grupo</Link>
          </nav>
          <div className="flex items-center gap-2">
            <details className="relative sm:hidden">
              <summary aria-label="Abrir navegação" className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border bg-[var(--surface-muted)] text-xl">☰</summary>
              <nav aria-label="Navegação mobile" className="absolute right-0 mt-2 w-52 rounded-2xl border bg-[var(--surface)] p-2 shadow-xl">
                <Link href="/dashboard" className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]">Grupos</Link>
                <Link href="/app/groups/new" className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]">Criar grupo</Link>
              </nav>
            </details>
            <ThemeToggle />
            <details className="relative">
              <summary aria-label="Abrir menu do usuário" className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-1.5 transition hover:bg-[var(--surface-muted)] sm:pr-3">
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt={`Avatar de ${name}`} width={32} height={32} className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-[var(--accent)] text-sm font-bold text-[#07150c]">{initial}</span>
                )}
                <span className="hidden max-w-32 truncate text-sm md:block">{name}</span>
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
