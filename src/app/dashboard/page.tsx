import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type Membership = {
  role: "owner" | "member";
  group: { id: string; name: string; description: string | null } | null;
};

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
    content_approved: "Conteúdo aprovado",
    content_completed: "Conteúdo concluído",
    rating_created: "Avaliação criada",
    rating_updated: "Avaliação alterada",
  };
  return labels[eventType] ?? "Atividade registrada";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: profile }, { data: membershipRows }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", authData.user!.id).single(),
    supabase.from("group_members").select("role, group:groups(id, name, description)").eq("user_id", authData.user!.id).eq("status", "active").order("joined_at", { ascending: false }),
  ]);
  const memberships = (membershipRows ?? []) as unknown as Membership[];
  const groupIds = memberships.flatMap(({ group }) => group ? [group.id] : []);

  const [membersResult, contentsResult, activitiesResult] = groupIds.length
    ? await Promise.all([
        supabase.from("group_members").select("group_id").in("group_id", groupIds).eq("status", "active"),
        supabase.from("contents").select("group_id, status").in("group_id", groupIds),
        supabase.from("group_activities").select("group_id, event_type, created_at").in("group_id", groupIds).order("created_at", { ascending: false }).limit(Math.max(100, groupIds.length * 10)),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const memberCounts = new Map<string, number>();
  for (const member of membersResult.data ?? []) memberCounts.set(member.group_id, (memberCounts.get(member.group_id) ?? 0) + 1);
  const contentCounts = new Map<string, { pending: number; approved: number }>();
  for (const content of contentsResult.data ?? []) {
    const current = contentCounts.get(content.group_id) ?? { pending: 0, approved: 0 };
    if (content.status === "pending") current.pending += 1;
    if (content.status === "approved") current.approved += 1;
    contentCounts.set(content.group_id, current);
  }
  const lastActivities = new Map<string, { label: string; createdAt: string }>();
  for (const activity of activitiesResult.data ?? []) {
    if (!lastActivities.has(activity.group_id)) {
      lastActivities.set(activity.group_id, { label: activityLabel(activity.event_type), createdAt: activity.created_at });
    }
  }

  const groups = memberships.flatMap(({ group, role }): GroupCardData[] => {
    if (!group) return [];
    const counts = contentCounts.get(group.id) ?? { pending: 0, approved: 0 };
    return [{
      ...group,
      role,
      memberCount: memberCounts.get(group.id) ?? 0,
      pendingCount: counts.pending,
      approvedCount: counts.approved,
      lastActivity: lastActivities.get(group.id) ?? null,
    }];
  });
  const name = profile?.name?.trim() || authData.user?.email?.split("@")[0] || "usuário";

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-(--accent-strong)">Seu espaço privado</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Olá, {name}</h1>
          <p className="mt-2 text-(--muted)">Acompanhe seus grupos e as próximas escolhas.</p>
        </div>
        <Link href="/app/groups/new" className="rounded-xl bg-(--accent) px-5 py-3 text-center text-sm font-bold text-[#07150c] transition hover:brightness-90">Criar grupo</Link>
      </div>

      {groups.length ? (
        <section aria-labelledby="groups-title">
          <h2 id="groups-title" className="sr-only">Seus grupos</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => <GroupCard key={group.id} group={group} />)}
          </div>
        </section>
      ) : (
        <EmptyState
          title="Nenhum grupo ainda"
          description="Crie seu primeiro grupo ou aceite um convite para começar."
          action={<Link href="/app/groups/new" className="inline-block rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c]">Criar primeiro grupo</Link>}
        />
      )}
    </main>
  );
}
