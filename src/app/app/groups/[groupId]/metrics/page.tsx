import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
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

function rankLabel(index: number) {
  return `${index + 1}º`;
}

function RankingBar({ value, maximum }: { value: number; maximum: number }) {
  const width = maximum > 0 ? Math.max(6, Math.round((value / maximum) * 100)) : 0;
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--surface-muted)" aria-hidden>
      <div className="h-full rounded-full bg-(--accent)" style={{ width: `${width}%` }} />
    </div>
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
      .select("id")
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
  const maximumActivity = activeMembers[0]?.activity_score ?? 0;
  const maximumMessages = discussedContents[0]?.message_count ?? 0;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Grupos", href: "/dashboard" },
          { label: group.name, href: `/app/groups/${groupId}` },
          { label: "Métricas" },
        ]}
      />
      <section className="mt-6 rounded-3xl border bg-(--surface) p-7 sm:p-9">
        <p className="text-sm font-semibold text-(--accent-strong)">Dashboard do grupo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{group.name}</h1>
        <p className="mt-3 max-w-2xl text-(--muted)">
          Rankings calculados com as contribuições dos membros ativos.
        </p>
      </section>

      {hasError ? (
        <p role="alert" className="mt-8 rounded-2xl bg-red-500/10 p-5 text-sm text-red-500">
          Não foi possível carregar as métricas do grupo.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border bg-(--surface) p-6 sm:p-7">
            <div>
              <p className="text-sm font-semibold text-(--accent-strong)">Top 5</p>
              <h2 className="mt-1 text-2xl font-bold">Conteúdos mais bem avaliados</h2>
              <p className="mt-2 text-sm text-(--muted)">
                Média das avaliações feitas pelos membros ativos.
              </p>
            </div>
            {ratedContents.length ? (
              <ol className="mt-6 divide-y">
                {ratedContents.map((content, index) => (
                  <li key={content.content_id}>
                    <Link
                      href={`/app/groups/${groupId}/contents/${content.content_id}`}
                      className="flex items-center gap-4 py-4 transition hover:text-(--accent-strong)"
                    >
                      <span className="w-8 text-lg font-black text-(--muted)">{rankLabel(index)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{content.title}</span>
                        <span className="mt-1 block text-xs text-(--muted)">
                          {CONTENT_TYPE_META[content.type].label} · {content.rating_count}{" "}
                          {content.rating_count === 1 ? "avaliação" : "avaliações"}
                        </span>
                      </span>
                      <strong className="shrink-0 text-lg">
                        {Number(content.average_rating).toFixed(1)} ★
                      </strong>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title="Sem avaliações"
                  description="Os conteúdos concluídos e avaliados aparecerão neste ranking."
                />
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-(--surface) p-6 sm:p-7">
            <div>
              <p className="text-sm font-semibold text-(--accent-strong)">Top 5</p>
              <h2 className="mt-1 text-2xl font-bold">Membros mais ativos</h2>
              <p className="mt-2 text-sm text-(--muted)">
                Soma de indicações, votos, avaliações e mensagens.
              </p>
            </div>
            {activeMembers.length ? (
              <ol className="mt-6 space-y-3">
                {activeMembers.map((member, index) => (
                  <li key={member.member_id} className="rounded-2xl border p-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-lg font-black text-(--muted)">
                        {rankLabel(index)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{member.name}</span>
                      <strong>{member.activity_score} pts</strong>
                    </div>
                    <RankingBar value={member.activity_score} maximum={maximumActivity} />
                    <p className="mt-3 text-xs text-(--muted)">
                      {member.content_count} indicações · {member.vote_count} votos ·{" "}
                      {member.rating_count} avaliações · {member.message_count} mensagens
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section className="rounded-3xl border bg-(--surface) p-6 sm:p-7 lg:col-span-2">
            <div>
              <p className="text-sm font-semibold text-(--accent-strong)">Top 3</p>
              <h2 className="mt-1 text-2xl font-bold">Conteúdos mais discutidos</h2>
              <p className="mt-2 text-sm text-(--muted)">
                Mensagens publicadas e não removidas por membros ativos.
              </p>
            </div>
            {discussedContents.length ? (
              <ol className="mt-6 grid gap-4 md:grid-cols-3">
                {discussedContents.map((content, index) => (
                  <li key={content.content_id}>
                    <Link
                      href={`/app/groups/${groupId}/contents/${content.content_id}`}
                      className="block h-full rounded-2xl border p-5 transition hover:border-(--accent)"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-2xl font-black text-(--muted)">
                          {rankLabel(index)}
                        </span>
                        <span className="rounded-full bg-(--surface-muted) px-2.5 py-1 text-xs">
                          {CONTENT_TYPE_META[content.type].label}
                        </span>
                      </div>
                      <h3 className="mt-5 line-clamp-2 font-bold">{content.title}</h3>
                      <p className="mt-2 text-sm text-(--muted)">
                        {content.message_count}{" "}
                        {content.message_count === 1 ? "mensagem" : "mensagens"}
                      </p>
                      <RankingBar value={content.message_count} maximum={maximumMessages} />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title="Nenhuma discussão"
                  description="As conversas nos conteúdos aparecerão neste ranking."
                />
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
