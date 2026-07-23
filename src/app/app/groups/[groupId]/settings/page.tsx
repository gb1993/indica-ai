import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/action-form";
import { createClient } from "@/lib/supabase/server";

import { deleteGroup, updateGroup } from "../../actions";

export const metadata: Metadata = { title: "Configurações do grupo" };

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: membership }] = await Promise.all([
    supabase.from("groups").select("id, name, description").eq("id", groupId).single(),
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", authData.user!.id).eq("status", "active").single(),
  ]);
  if (!group || membership?.role !== "owner") notFound();

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href={`/app/groups/${groupId}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Voltar ao grupo</Link>
      <section className="mt-6 rounded-3xl border bg-[var(--surface)] p-7 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <ActionForm
          action={updateGroup}
          submitLabel="Salvar alterações"
          pendingLabel="Salvando…"
          className="mt-6 space-y-5"
          buttonClassName="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">Nome</label>
            <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={group.name} className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3" />
          </div>
          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium">Descrição</label>
            <textarea id="description" name="description" maxLength={500} rows={4} defaultValue={group.description ?? ""} className="w-full resize-y rounded-xl border bg-[var(--surface-muted)] px-4 py-3" />
          </div>
        </ActionForm>
      </section>
      <section className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/5 p-7">
        <h2 className="text-lg font-bold text-red-500">Excluir grupo</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Esta ação remove o grupo, seus membros e convites permanentemente.</p>
        <ActionForm
          action={deleteGroup}
          submitLabel="Excluir permanentemente"
          pendingLabel="Excluindo…"
          confirmMessage="Excluir este grupo permanentemente? Esta ação não pode ser desfeita."
          className="mt-5 space-y-3"
          buttonClassName="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          <input type="hidden" name="groupId" value={groupId} />
        </ActionForm>
      </section>
    </main>
  );
}
