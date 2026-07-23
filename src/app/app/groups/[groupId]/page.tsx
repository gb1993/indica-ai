import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentCard, type ContentCardData } from "@/components/content-card";
import type { ContentStatus } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupo" };

type ContentRow = Omit<ContentCardData, "average_rating" | "rating_count"> & {
  ratings: Array<{ rating: number }>;
};

const sections: Array<{ status: ContentStatus; title: string; empty: string }> = [
  { status: "pending", title: "Aguardando aprovação", empty: "Nenhum conteúdo aguardando aprovação." },
  { status: "approved", title: "Próximos", empty: "Nenhum conteúdo aprovado por enquanto." },
  { status: "completed", title: "Concluídos", empty: "Nenhum conteúdo concluído por enquanto." },
];

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: membership }, { count }, { data: contentRows }] = await Promise.all([
    supabase.from("groups").select("id, name, description").eq("id", groupId).single(),
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", authData.user!.id).eq("status", "active").single(),
    supabase.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "active"),
    supabase.from("contents").select("id, group_id, type, title, description, thumbnail_url, status, completed_at, ratings:content_ratings(rating)").eq("group_id", groupId).order("created_at", { ascending: false }),
  ]);
  if (!group || !membership) notFound();
  const isOwner = membership.role === "owner";
  const contents = ((contentRows ?? []) as unknown as ContentRow[]).map((content) => {
    const ratings = content.ratings ?? [];
    const averageRating = ratings.length
      ? ratings.reduce((total, item) => total + item.rating, 0) / ratings.length
      : null;
    return {
      ...content,
      average_rating: averageRating,
      rating_count: ratings.length,
    } satisfies ContentCardData;
  });
  const firstVisibleContentId = sections
    .flatMap((section) => contents.filter((content) => content.status === section.status))
    .at(0)?.id;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
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
            <Link href={`/app/groups/${groupId}/contents/new`} className="cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[#07150c] transition hover:brightness-90">Adicionar conteúdo</Link>
            <Link href={`/app/groups/${groupId}/members`} className="cursor-pointer rounded-xl border bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold transition hover:brightness-90">Membros</Link>
            {isOwner && <Link href={`/app/groups/${groupId}/settings`} className="cursor-pointer rounded-xl border bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold transition hover:brightness-90">Configurações</Link>}
          </div>
        </div>
      </section>

      <nav aria-label="Seções do grupo" className="mt-6 flex gap-2 border-b">
        <span aria-current="page" className="border-b-2 border-[var(--accent)] px-4 py-3 text-sm font-bold">Conteúdos</span>
        <Link href={`/app/groups/${groupId}/activities`} className="px-4 py-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Atividades</Link>
      </nav>

      <div className="mt-10 space-y-12">
        {sections.map((section) => {
          const items = contents.filter((content) => content.status === section.status);
          return (
            <section key={section.status}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
                <span className="text-sm text-[var(--muted)]">{items.length}</span>
              </div>
              {items.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((content) => (
                    <ContentCard
                      key={content.id}
                      content={content}
                      eager={content.id === firstVisibleContentId}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed bg-[var(--surface)] p-7 text-sm text-[var(--muted)]">{section.empty}</div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
