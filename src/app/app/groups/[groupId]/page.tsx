import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: membership }, { count }] = await Promise.all([
    supabase.from("groups").select("id, name, description").eq("id", groupId).single(),
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", authData.user!.id).eq("status", "active").single(),
    supabase.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "active"),
  ]);
  if (!group || !membership) notFound();
  const isOwner = membership.role === "owner";

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Voltar aos grupos</Link>
      <section className="mt-6 rounded-3xl border bg-[var(--surface)] p-7 sm:p-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--muted)]">{isOwner ? "Proprietário" : "Membro"}</span>
              <span className="text-sm text-[var(--muted)]">{count ?? 0} {(count ?? 0) === 1 ? "membro" : "membros"}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{group.name}</h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-[var(--muted)]">{group.description || "Este grupo ainda não possui descrição."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/groups/${groupId}/members`} className="cursor-pointer rounded-xl border bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold transition hover:brightness-90">Membros</Link>
            {isOwner && <Link href={`/app/groups/${groupId}/settings`} className="cursor-pointer rounded-xl border bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold transition hover:brightness-90">Configurações</Link>}
          </div>
        </div>
        <div className="mt-10 rounded-2xl bg-[var(--surface-muted)] p-6">
          <h2 className="font-bold">Conteúdos do grupo</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">As indicações serão adicionadas na próxima etapa do projeto.</p>
        </div>
      </section>
    </main>
  );
}
