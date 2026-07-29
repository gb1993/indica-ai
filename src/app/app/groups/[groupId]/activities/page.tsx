import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { AppIcon } from "@/components/app-icon";
import { LocalDateTime } from "@/components/local-date-time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Atividades do grupo" };

const ACTIVITIES_PER_PAGE = 20;

type Activity = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { name: string } | null;
};

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function activityDescription(activity: Activity) {
  const title = metadataText(activity.metadata, "title");
  const name = metadataText(activity.metadata, "name");
  const target = title ? ` “${title}”` : "";

  switch (activity.event_type) {
    case "group_created": return `criou o grupo${name ? ` “${name}”` : ""}`;
    case "group_updated": return `alterou o grupo${name ? ` “${name}”` : ""}`;
    case "invitation_sent": return "enviou um convite";
    case "invitation_cancelled": return "cancelou um convite";
    case "invitation_accepted": return "aceitou um convite";
    case "member_removed": return "removeu um membro";
    case "content_created": return `criou o conteúdo${target}`;
    case "content_updated": return `atualizou o conteúdo${target}`;
    case "content_deleted": return `excluiu o conteúdo${target}`;
    case "content_completed": return `marcou o conteúdo${target} como concluído`;
    case "rating_created": return `avaliou um conteúdo com ${Number(activity.metadata.rating) || "—"} de 5`;
    case "rating_updated": return `alterou uma avaliação para ${Number(activity.metadata.rating) || "—"} de 5`;
    default: return "realizou uma atividade";
  }
}

export default async function GroupActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { groupId } = await params;
  const requestedPage = Number((await searchParams).page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * ACTIVITIES_PER_PAGE;
  const supabase = await createClient();
  const [{ data: group }, { data: rows, count, error }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).single(),
    supabase
      .from("group_activities")
      .select("id, event_type, entity_type, entity_id, metadata, created_at, actor:profiles!group_activities_actor_id_fkey(name)", { count: "exact" })
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .range(from, from + ACTIVITIES_PER_PAGE - 1),
  ]);
  if (!group) notFound();

  const activities = (rows ?? []) as unknown as Activity[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / ACTIVITIES_PER_PAGE));

  return (
    <main id="main-content" className="app-page max-w-5xl">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name, href: `/app/groups/${groupId}` }, { label: "Atividades" }]} />
      <header className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--accent-strong)">Histórico do grupo</p>
        <h1 className="text-3xl font-bold tracking-tight">Atividades</h1>
        <p className="mt-2 text-sm text-(--muted)">Histórico privado de {group.name}.</p>
      </header>

      <section className="mt-7">
        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-500">Não foi possível carregar as atividades.</p>
        ) : activities.length ? (
          <ol className="space-y-3">
            {activities.map((activity) => (
              <li key={activity.id} className="app-panel flex gap-4 p-5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-(--accent-soft) text-(--accent-strong)">
                  <AppIcon name="sparkles" className="size-4.5" />
                </span>
                <div>
                  <p className="leading-relaxed">
                    <strong>{activity.actor?.name ?? metadataText(activity.metadata, "actor_name") ?? "Sistema"}</strong>{" "}
                    <span className="text-(--muted)">{activityDescription(activity)}</span>
                  </p>
                  <LocalDateTime
                    value={activity.created_at}
                    dateStyle="medium"
                    timeStyle="short"
                    className="mt-2 block text-xs text-(--muted)"
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed bg-(--surface) p-7 text-sm text-(--muted)">Nenhuma atividade registrada ainda.</p>
        )}

        {!error && totalPages > 1 ? (
          <nav aria-label="Paginação das atividades" className="mt-6 flex items-center justify-between gap-4 text-sm">
            {page > 1 ? (
              <Link href={`?page=${page - 1}`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-(--surface-muted)">
                <AppIcon name="arrow-left" className="size-4" />
                Anterior
              </Link>
            ) : <span />}
            <span className="text-(--muted)">Página {Math.min(page, totalPages)} de {totalPages}</span>
            {page < totalPages ? (
              <Link href={`?page=${page + 1}`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-(--surface-muted)">
                Próxima
                <AppIcon name="arrow-right" className="size-4" />
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
