import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { getDashboardContext } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

function activityLabel(eventType: string) {
  const labels: Record<string, string> = {
    group_created: "Grupo criado",
    group_updated: "Grupo alterado",
    invitation_sent: "Convite enviado",
    invitation_cancelled: "Convite cancelado",
    invitation_accepted: "Convite aceito",
    member_removed: "Membro removido",
    content_created: "Conteúdo criado",
    content_updated: "Conteúdo atualizado",
    content_deleted: "Conteúdo excluído",
    content_completed: "Conteúdo concluído",
    rating_created: "Avaliação criada",
    rating_updated: "Avaliação alterada",
  };
  return labels[eventType] ?? "Atividade registrada";
}

export default async function DashboardPage() {
  const { user, profile, groups: dashboardGroups } = await getDashboardContext();
  if (!user) redirect("/");

  const groups = dashboardGroups.map((group): GroupCardData => ({
    id: group.group_id,
    name: group.name,
    description: group.description,
    role: group.role,
    memberCount: Number(group.member_count),
    availableCount: Number(group.pending_count),
    completedCount: Number(group.completed_count),
    lastActivity:
      group.last_activity_event_type && group.last_activity_created_at
        ? {
            label: activityLabel(group.last_activity_event_type),
            createdAt: group.last_activity_created_at,
          }
        : null,
  }));
  const name = profile?.name?.trim() || user.email?.split("@")[0] || "usuário";

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-5 py-8 sm:px-7 sm:py-10">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--accent-strong)">Seu espaço privado</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Olá, {name}</h1>
          <p className="mt-2 text-sm text-(--muted)">Acompanhe seus grupos e as próximas escolhas.</p>
        </div>
        <Link href="/app/groups/new" className="app-button-primary">＋ Criar grupo</Link>
      </div>

      {groups.length ? (
        <section aria-labelledby="groups-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="groups-title" className="text-lg font-bold">Seus grupos</h2>
            <span className="text-xs text-(--muted)">{groups.length} {groups.length === 1 ? "grupo" : "grupos"}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => <GroupCard key={group.id} group={group} />)}
          </div>
        </section>
      ) : (
        <EmptyState
          title="Nenhum grupo ainda"
          description="Crie seu primeiro grupo ou aceite um convite para começar."
          action={<Link href="/app/groups/new" className="app-button-primary">Criar primeiro grupo</Link>}
        />
      )}
    </main>
  );
}
