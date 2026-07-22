import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type Membership = {
  role: "owner" | "member";
  group: {
    id: string;
    name: string;
    description: string | null;
    updated_at: string;
  } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("group_members")
    .select("role, group:groups(id, name, description, updated_at)")
    .eq("user_id", authData.user!.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false });
  const memberships = (data ?? []) as unknown as Membership[];

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--accent-strong)]">Seu espaço privado</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Seus grupos</h1>
          <p className="mt-2 text-[var(--muted)]">Organize as próximas escolhas com seus amigos.</p>
        </div>
        <Link href="/app/groups/new" className="cursor-pointer rounded-xl bg-[var(--accent)] px-5 py-3 text-center text-sm font-bold text-[#07150c] transition hover:brightness-90">
          Criar grupo
        </Link>
      </div>

      {memberships.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ group, role }) => group && (
            <Link key={group.id} href={`/app/groups/${group.id}`} className="group rounded-2xl border bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)]">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold group-hover:text-[var(--accent-strong)]">{group.name}</h2>
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted)]">{role === "owner" ? "Proprietário" : "Membro"}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{group.description || "Sem descrição."}</p>
            </Link>
          ))}
        </div>
      ) : (
        <section className="rounded-3xl border border-dashed bg-[var(--surface)] p-10 text-center">
          <h2 className="text-xl font-bold">Nenhum grupo ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">Crie seu primeiro grupo ou aceite um convite para começar.</p>
        </section>
      )}
    </main>
  );
}
