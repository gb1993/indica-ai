import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/action-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GroupForm } from "@/components/group-form";
import { createClient } from "@/lib/supabase/server";

import { deleteGroup } from "../../actions";

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
    <main id="main-content" className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name, href: `/app/groups/${groupId}` }, { label: "Configurações" }]} />
      <section className="mt-6 rounded-3xl border bg-[var(--surface)] p-7 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <div className="mt-6"><GroupForm group={group} /></div>
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
