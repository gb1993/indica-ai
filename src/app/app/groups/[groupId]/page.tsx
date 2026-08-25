import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppIcon } from "@/components/app-icon";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Carousel } from "@/components/carousel";
import { CompletedContentsGrid } from "@/components/completed-contents-grid";
import { ContentCard, type ContentCardData } from "@/components/content-card";
import { EmptyState } from "@/components/empty-state";
import { LiveStreamPanel } from "@/components/live-stream-panel";
import type { ActivityRank } from "@/components/most-active-badge";
import { type ContentStatus } from "@/lib/content";
import type { LiveStreamSession } from "@/lib/live-stream";
import { getLiveStreamUsageStatus } from "@/lib/live-stream-capacity";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupo" };

type ContentRow = Omit<ContentCardData, "average_rating" | "rating_count" | "creator_activity_rank"> & {
  ratings: Array<{ rating: number }>;
};

const sections: Array<{ status: ContentStatus; title: string; subtitle: string; empty: string }> = [
  {
    status: "pending",
    title: "Disponíveis para avaliar",
    subtitle: "As indicações ficam disponíveis imediatamente. A primeira avaliação marca o conteúdo como concluído.",
    empty: "Nenhum conteúdo aguardando avaliação.",
  },
  {
    status: "completed",
    title: "Conteúdos concluídos",
    subtitle: "Veja as avaliações e compartilhe sua opinião com os demais membros.",
    empty: "Nenhum conteúdo concluído por enquanto.",
  },
];

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { groupId } = await params;
  const query = await searchParams;
  const activeStatus = sections.some((section) => section.status === query.status)
    ? query.status as ContentStatus
    : null;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: membership }, { data: memberRows, count }, { data: contentRows }, mostActiveResult, { data: liveRow }, liveUsageStatus] = await Promise.all([
    supabase.from("groups").select("id, name, description").eq("id", groupId).single(),
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", authData.user!.id).eq("status", "active").single(),
    supabase.from("group_members").select("user:profiles!group_members_user_id_fkey(id, name, avatar_url)", { count: "exact" }).eq("group_id", groupId).eq("status", "active"),
    supabase.from("contents").select("id, group_id, type, title, description, thumbnail_url, status, completed_at, creator:profiles!contents_created_by_fkey(id, name), ratings:content_ratings(rating)").eq("group_id", groupId).order("created_at", { ascending: false }),
    supabase.rpc("get_group_most_active_members", { p_group_id: groupId }),
    supabase
      .from("live_stream_sessions")
      .select("id, group_id, host_user_id, started_at, host:profiles!live_stream_sessions_host_user_id_fkey(name)")
      .eq("group_id", groupId)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getLiveStreamUsageStatus(supabase),
  ]);
  if (!group || !membership) notFound();
  const isOwner = membership.role === "owner";
  const typedLiveRow = liveRow as unknown as {
    id: string;
    group_id: string;
    host_user_id: string;
    started_at: string | null;
    host: { name: string } | null;
  } | null;
  const initialLiveSession: LiveStreamSession | null = typedLiveRow
    ? {
        id: typedLiveRow.id,
        groupId: typedLiveRow.group_id,
        hostUserId: typedLiveRow.host_user_id,
        hostName: typedLiveRow.host?.name ?? "Um membro",
        startedAt: typedLiveRow.started_at,
      }
    : null;
  const liveMemberProfiles = ((memberRows ?? []) as unknown as Array<{
    user: { id: string; name: string; avatar_url: string | null } | null;
  }>).flatMap((member) => member.user ? [member.user] : []);
  const activityRanks = new Map<string, ActivityRank>(
    (Array.isArray(mostActiveResult.data) ? mostActiveResult.data : [])
      .slice(0, 3)
      .flatMap((member, index) => Number(member.activity_score) > 0
        ? [[member.member_id, (index + 1) as ActivityRank] as const]
        : []),
  );
  const contents = ((contentRows ?? []) as unknown as ContentRow[]).map((content) => {
    const ratings = content.ratings ?? [];
    const averageRating = ratings.length
      ? ratings.reduce((total, item) => total + item.rating, 0) / ratings.length
      : null;
    return {
      ...content,
      average_rating: averageRating,
      rating_count: ratings.length,
      creator_activity_rank: content.creator
        ? activityRanks.get(content.creator.id) ?? null
        : null,
    } satisfies ContentCardData;
  });
  const visibleSections = activeStatus
    ? sections.filter((section) => section.status === activeStatus)
    : sections;
  const firstVisibleContentId = visibleSections
    .flatMap((section) => contents.filter((content) => content.status === section.status))
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
            <Link href={`/app/groups/${groupId}/metrics`} className="app-button-primary">
              <AppIcon name="chart" className="size-4" />
              Métricas
            </Link>
            <Link href={`/app/groups/${groupId}/contents/new`} className="app-button-secondary">
              <AppIcon name="plus" className="size-4" />
              Adicionar conteúdo
            </Link>
            <Link href={`/app/groups/${groupId}/members`} className="app-button-secondary">
              <AppIcon name="users" className="size-4" />
              Membros
            </Link>
            <Link href={`/app/groups/${groupId}/activities`} className="app-button-secondary">
              <AppIcon name="activity" className="size-4" />
              Atividades
            </Link>
            {isOwner && (
              <Link href={`/app/groups/${groupId}/settings`} className="app-button-secondary">
                <AppIcon name="settings" className="size-4" />
                Configurações
              </Link>
            )}
          </div>
        </div>
      </section>

      {(initialLiveSession || liveUsageStatus.canStart) && (
        <LiveStreamPanel
          groupId={groupId}
          userId={authData.user!.id}
          memberProfiles={liveMemberProfiles}
          initialSession={initialLiveSession}
          initialUsageStatus={liveUsageStatus}
        />
      )}

      <section aria-label="Filtrar conteúdos por status" className="mt-8 border-b">
        <div className="flex gap-1 overflow-x-auto">
          <Link href={`/app/groups/${groupId}`} aria-current={!activeStatus ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm transition ${!activeStatus ? "border-b-(--accent) font-semibold text-(--foreground)" : "border-b-transparent text-(--muted) hover:text-(--foreground)"}`}>Todos</Link>
          {sections.map((section) => {
            const params = new URLSearchParams();
            params.set("status", section.status);
            return (
              <Link key={section.status} href={`/app/groups/${groupId}?${params}`} aria-current={activeStatus === section.status ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm transition ${activeStatus === section.status ? "border-b-(--accent) font-semibold text-(--foreground)" : "border-b-transparent text-(--muted) hover:text-(--foreground)"}`}>
                {section.title}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-8 space-y-10">
        {visibleSections.map((section) => {
          const items = contents.filter((content) => content.status === section.status);
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
                section.status === "completed" || activeStatus === "pending" ? (
                  <CompletedContentsGrid
                    contents={items}
                    eagerContentId={firstVisibleContentId}
                  />
                ) : (
                  <Carousel
                    ariaLabel={section.title}
                    slideClassName="basis-[82%] sm:basis-[48%] lg:basis-1/3 xl:basis-1/4"
                  >
                    {items.map((content) => (
                      <ContentCard
                        key={content.id}
                        content={content}
                        eager={content.id === firstVisibleContentId}
                      />
                    ))}
                  </Carousel>
                )
              ) : (
                <EmptyState
                  title={section.title}
                  description={section.empty}
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
