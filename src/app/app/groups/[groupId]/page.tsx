import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContentCard, type ContentCardData } from "@/components/content-card";
import { EmptyState } from "@/components/empty-state";
import { CONTENT_TYPES, CONTENT_TYPE_META, type ContentStatus, type ContentType } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupo" };

type ContentRow = Omit<ContentCardData, "average_rating" | "rating_count"> & {
  ratings: Array<{ rating: number }>;
};

const sections: Array<{ status: ContentStatus; title: string; subtitle: string; empty: string }> = [
  {
    status: "pending",
    title: "Indicado pelo grupo",
    subtitle: "Vote nas indicações. A maioria dos membros ativos precisa aprovar para o conteúdo avançar.",
    empty: "Nenhum conteúdo aguardando aprovação.",
  },
  {
    status: "approved",
    title: "Próximos conteúdos",
    subtitle: "Assista, leia ou acompanhe os conteúdos aprovados e marque cada um como concluído ao finalizar.",
    empty: "Nenhum conteúdo para ver...",
  },
  {
    status: "completed",
    title: "Conteúdos concluídos",
    subtitle: "Avalie o que o grupo já concluiu e compartilhe sua opinião com os demais membros.",
    empty: "Nenhum conteúdo concluído por enquanto.",
  },
];

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { groupId } = await params;
  const query = await searchParams;
  const activeType = CONTENT_TYPES.includes(query.type as ContentType) ? query.type as ContentType : null;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: membership }, { count }, { data: contentRows }] = await Promise.all([
    supabase.from("groups").select("id, name, description").eq("id", groupId).single(),
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", authData.user!.id).eq("status", "active").single(),
    supabase.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "active"),
    supabase.from("contents").select("id, group_id, type, title, description, thumbnail_url, status, completed_at, creator:profiles!contents_created_by_fkey(name), ratings:content_ratings(rating)").eq("group_id", groupId).order("created_at", { ascending: false }),
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
  const filteredContents = activeType ? contents.filter((content) => content.type === activeType) : contents;
  const firstVisibleContentId = sections
    .flatMap((section) => filteredContents.filter((content) => content.status === section.status))
    .at(0)?.id;

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-5 py-8 sm:px-7 sm:py-10">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name }]} />
      <section className="mt-5">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-full border bg-(--accent-soft) px-3 py-1 text-xs text-(--accent-strong)">{isOwner ? "Proprietário" : "Membro"}</span>
              <span className="text-sm text-(--muted)">{count ?? 0} {(count ?? 0) === 1 ? "membro" : "membros"}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-(--muted)">{group.description || "Este grupo ainda não possui descrição."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/groups/${groupId}/metrics`} className="app-button-primary">Métricas</Link>
            <Link href={`/app/groups/${groupId}/contents/new`} className="app-button-secondary">＋ Adicionar conteúdo</Link>
            <Link href={`/app/groups/${groupId}/members`} className="app-button-secondary">Membros</Link>
            <Link href={`/app/groups/${groupId}/activities`} className="app-button-secondary">Atividades</Link>
            {isOwner && <Link href={`/app/groups/${groupId}/settings`} className="app-button-secondary">Configurações</Link>}
          </div>
        </div>
      </section>

      <section aria-label="Filtrar conteúdos por tipo" className="mt-8 border-b">
        <div className="flex gap-1 overflow-x-auto">
          <Link href={`/app/groups/${groupId}`} aria-current={!activeType ? "true" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm transition ${!activeType ? "border-(--accent) font-semibold text-(--foreground)" : "border-transparent text-(--muted) hover:text-(--foreground)"}`}>Todos</Link>
          {CONTENT_TYPES.map((type) => {
            const params = new URLSearchParams();
            params.set("type", type);
            return (
              <Link key={type} href={`/app/groups/${groupId}?${params}`} aria-current={activeType === type ? "true" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm transition ${activeType === type ? "border-(--accent) font-semibold text-(--foreground)" : "border-transparent text-(--muted) hover:text-(--foreground)"}`}>
                <span aria-hidden>{CONTENT_TYPE_META[type].icon}</span> {CONTENT_TYPE_META[type].label}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-8 space-y-10">
        {sections.map((section) => {
          const items = filteredContents.filter((content) => content.status === section.status);
          return (
            <section key={section.status}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-(--muted)">{section.subtitle}</p>
                </div>
                <span className="grid min-w-7 place-items-center rounded-full bg-(--surface-muted) px-2 py-1 text-xs text-(--muted)">{items.length}</span>
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
                <EmptyState
                  title={section.title}
                  description={activeType ? `Nenhum conteúdo do tipo ${CONTENT_TYPE_META[activeType].label.toLowerCase()} nesta seção.` : section.empty}
                  action={section.status !== "completed" ? (
                    <Link
                      href={`/app/groups/${groupId}/contents/new`}
                      className="app-button-primary"
                    >
                      Adicionar conteúdo
                    </Link>
                  ) : undefined}
                />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
