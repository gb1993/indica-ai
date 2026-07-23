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
    <main id="main-content" className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name, href: `/app/groups/${groupId}` }, { label: "Cadastrar conteúdo" }]} />
      <section className="mt-6 rounded-3xl border bg-(--surface) p-7 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight">Cadastrar conteúdo</h1>
        <p className="mt-2 text-(--muted)">A indicação ficará aguardando aprovação.</p>
        <div className="mt-7">
          <ContentForm groupId={groupId} />
        </div>
      </section>
    </main>
  );
}
