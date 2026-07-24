import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppIcon } from "@/components/app-icon";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContentThumbnail } from "@/components/content-thumbnail";
import { EmptyState } from "@/components/empty-state";
import { CONTENT_TYPE_META, type ContentType } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Métricas do grupo" };

type RatedContent = {
  content_id: string;
  title: string;
  type: ContentType;
  average_rating: number;
  rating_count: number;
};

type ActiveMember = {
  member_id: string;
  name: string;
  content_count: number;
  vote_count: number;
  rating_count: number;
  message_count: number;
  activity_score: number;
};

type DiscussedContent = {
  content_id: string;
  title: string;
  type: ContentType;
  message_count: number;
};

function RankBadge({ position }: { position: number }) {
  const medalStyles = [
    "bg-[linear-gradient(145deg,#ffe28a,#eaa90d)] text-[#3d2a00]",
    "bg-[linear-gradient(145deg,#eef2f7,#9da8ba)] text-[#273244]",
    "bg-[linear-gradient(145deg,#f2b66d,#a45a20)] text-[#321700]",
  ];

  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black shadow-md ${
      medalStyles[position - 1] ?? "bg-[#b9c1d1] text-[#252b38]"
    }`}>
      {position}
    </span>
  );
}

function MemberInitial({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full border bg-[linear-gradient(145deg,#4c2b89,#171d2c)] text-xs font-bold text-white">
      {initials || "M"}
    </span>
  );
}

export default async function GroupMetricsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) notFound();

  const [{ data: group }, { data: membership }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).single(),
    supabase
      .from("group_members")
      .select("id, role")
      .eq("group_id", groupId)
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .single(),
  ]);
  if (!group || !membership) notFound();

  const [ratedResult, activeResult, discussedResult] = await Promise.all([
    supabase.rpc("get_group_top_rated_contents", { p_group_id: groupId }),
    supabase.rpc("get_group_most_active_members", { p_group_id: groupId }),
    supabase.rpc("get_group_most_discussed_contents", { p_group_id: groupId }),
  ]);
  const hasError = ratedResult.error || activeResult.error || discussedResult.error;
  const ratedContents = (ratedResult.data ?? []) as RatedContent[];
  const activeMembers = (activeResult.data ?? []) as ActiveMember[];
  const discussedContents = (discussedResult.data ?? []) as DiscussedContent[];
  const rankedIds = [...new Set([
    ...ratedContents.map((content) => content.content_id),
    ...discussedContents.map((content) => content.content_id),
  ])];
  const { data: contentImages } = rankedIds.length
    ? await supabase.from("contents").select("id, thumbnail_url").in("id", rankedIds)
    : { data: [] as Array<{ id: string; thumbnail_url: string | null }> };
  const thumbnails = new Map(
    (contentImages ?? []).map((content) => [content.id, content.thumbnail_url]),
  );

  return (
    <main id="main-content" className="mx-auto max-w-[92rem] px-5 py-8 sm:px-7 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Grupos", href: "/dashboard" },
          { label: group.name, href: `/app/groups/${groupId}` },
          { label: "Métricas" },
        ]}
      />

      <header className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard do Grupo</h1>
          <p className="mt-2 text-sm text-(--muted)">
            Acompanhe os destaques e a participação em {group.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {membership.role === "owner" ? (
            <Link href={`/app/groups/${groupId}/settings`} className="app-button-secondary">
              <AppIcon name="settings" className="size-4" />
              Gerenciar grupo
            </Link>
          ) : null}
          <Link href={`/app/groups/${groupId}/members`} className="app-button-primary">
            <AppIcon name="users" className="size-4" />
            Membros
          </Link>
        </div>
      </header>

      {hasError ? (
        <p role="alert" className="mt-8 rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-400">
          Não foi possível carregar as métricas do grupo.
        </p>
      ) : (
        <div className="mt-7 space-y-5">
          <section className="app-panel p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="flex items-center gap-3 text-xl font-bold">
                  <span aria-hidden className="text-2xl text-(--gold)">★</span>
                  Melhores avaliados
                </h2>
                <p className="mt-1 text-sm text-(--muted)">
                  Conteúdos com as maiores médias de avaliação do grupo.
                </p>
              </div>
              <Link href={`/app/groups/${groupId}`} className="app-button-secondary min-h-9 px-3 py-2 text-xs">
                Ver conteúdos
              </Link>
            </div>

            {ratedContents.length ? (
              <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {ratedContents.map((content, index) => (
                  <li key={content.content_id}>
                    <Link
                      href={`/app/groups/${groupId}/contents/${content.content_id}`}
                      className="group block h-full overflow-hidden rounded-xl border bg-(--surface) transition hover:-translate-y-1 hover:border-(--accent) motion-reduce:hover:translate-y-0"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-(--surface-muted)">
                        <ContentThumbnail
                          src={thumbnails.get(content.content_id) ?? null}
                          alt={`Capa de ${content.title}`}
                          title={content.title}
                          eager={index < 3}
                        />
                        <div className="absolute left-3 top-3">
                          <RankBadge position={index + 1} />
                        </div>
                      </div>
                      <div className="p-3.5">
                        <span className="inline-flex rounded-full bg-(--accent-soft) px-2 py-1 text-[0.65rem] text-(--accent-strong)">
                          {CONTENT_TYPE_META[content.type].label}
                        </span>
                        <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5 group-hover:text-(--accent-strong)">
                          {content.title}
                        </h3>
                        <p className="mt-3 flex items-center gap-2 text-sm">
                          <strong className="text-(--gold)">★ {Number(content.average_rating).toFixed(1)}</strong>
                          <span className="text-xs text-(--muted)">
                            {content.rating_count} {content.rating_count === 1 ? "avaliação" : "avaliações"}
                          </span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="Sem avaliações"
                  description="Os conteúdos concluídos e avaliados aparecerão neste ranking."
                />
              </div>
            )}
            <p className="mt-5 text-xs text-(--muted)">
              <span className="mr-1 text-(--accent-strong)">ⓘ</span>
              O ranking considera avaliações feitas por membros ativos.
            </p>
          </section>

          <section className="app-panel overflow-hidden">
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-start sm:p-6">
              <div>
                <h2 className="flex items-center gap-3 text-xl font-bold">
                  <AppIcon name="users" className="size-6 text-(--accent-strong)" />
                  Membros mais participativos
                </h2>
                <p className="mt-1 text-sm text-(--muted)">Ranking de participação dos membros do grupo.</p>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-(--muted) sm:text-right">
                Cada conteúdo, voto, avaliação e mensagem soma um ponto.
              </p>
            </div>

            {activeMembers.length ? (
              <div className="overflow-x-auto px-3 pb-4 sm:px-5">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 overflow-hidden rounded-xl border text-sm">
                  <thead className="bg-(--surface-muted) text-left text-xs font-medium text-(--muted)">
                    <tr>
                      <th className="px-5 py-3">Posição</th>
                      <th className="px-4 py-3">Membro</th>
                      <th className="px-4 py-3 text-center">Conteúdos</th>
                      <th className="px-4 py-3 text-center">Votos</th>
                      <th className="px-4 py-3 text-center">Avaliações</th>
                      <th className="px-4 py-3 text-center">Mensagens</th>
                      <th className="px-5 py-3 text-right text-(--gold)">Total de pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembers.map((member, index) => (
                      <tr key={member.member_id} className="border-t transition hover:bg-(--surface-muted)">
                        <td className="border-t px-5 py-3">
                          {index < 3 ? <RankBadge position={index + 1} /> : <span className="pl-2 text-(--muted)">{index + 1}</span>}
                        </td>
                        <td className="border-t px-4 py-3">
                          <span className="flex items-center gap-3">
                            <MemberInitial name={member.name} />
                            <strong className="whitespace-nowrap">{member.name}</strong>
                          </span>
                        </td>
                        <td className="border-t px-4 py-3 text-center">{member.content_count}</td>
                        <td className="border-t px-4 py-3 text-center">{member.vote_count}</td>
                        <td className="border-t px-4 py-3 text-center">{member.rating_count}</td>
                        <td className="border-t px-4 py-3 text-center">{member.message_count}</td>
                        <td className="border-t px-5 py-3 text-right text-base font-black text-(--gold)">{member.activity_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <EmptyState title="Sem atividade" description="As contribuições dos membros aparecerão aqui." />
              </div>
            )}
          </section>

          <section className="app-panel p-5 sm:p-6">
            <div>
              <h2 className="flex items-center gap-3 text-xl font-bold">
                <span aria-hidden className="text-xl text-(--accent-strong)">◌</span>
                Conteúdos mais discutidos
              </h2>
              <p className="mt-1 text-sm text-(--muted)">Conversas com maior participação dos membros ativos.</p>
            </div>
            {discussedContents.length ? (
              <ol className="mt-5 grid gap-4 md:grid-cols-3">
                {discussedContents.map((content, index) => (
                  <li key={content.content_id}>
                    <Link
                      href={`/app/groups/${groupId}/contents/${content.content_id}`}
                      className="group flex h-full items-center gap-4 rounded-xl border bg-(--surface) p-4 transition hover:border-(--accent)"
                    >
                      <RankBadge position={index + 1} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold group-hover:text-(--accent-strong)">{content.title}</span>
                        <span className="mt-1 block text-xs text-(--muted)">
                          {CONTENT_TYPE_META[content.type].label} · {content.message_count} {content.message_count === 1 ? "mensagem" : "mensagens"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-5">
                <EmptyState title="Nenhuma discussão" description="As conversas nos conteúdos aparecerão neste ranking." />
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
