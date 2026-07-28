import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContentForm } from "@/components/content-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Novo conteúdo" };

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", groupId)
    .single();

  if (!group) notFound();

  return (
    <main id="main-content" className="app-page max-w-3xl">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name, href: `/app/groups/${groupId}` }, { label: "Cadastrar conteúdo" }]} />
      <section className="app-panel mt-6 p-7 sm:p-9">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--accent-strong)">Nova indicação</p>
        <h1 className="text-3xl font-bold tracking-tight">Indicar novo conteúdo</h1>
        <p className="mt-2 text-sm text-(--muted)">A indicação ficará aguardando aprovação.</p>
        <div className="mt-7">
          <ContentForm groupId={groupId} />
        </div>
      </section>
    </main>
  );
}
