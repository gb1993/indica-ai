import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/action-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GroupTabs } from "@/components/group-tabs";
import { InvitationForm } from "@/components/invitation-form";
import { createClient } from "@/lib/supabase/server";

import {
  cancelInvitation,
  removeMember,
  resendInvitation,
} from "../../actions";

export const metadata: Metadata = { title: "Membros do grupo" };

type Member = {
  id: string;
  role: "owner" | "member";
  joined_at: string;
  user: { id: string; name: string; email: string; avatar_url: string | null } | null;
};

type Invitation = {
  id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

function invitationStatus(invitation: Invitation) {
  if (invitation.accepted_at) return "Aceito";
  if (invitation.cancelled_at) return "Cancelado";
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return "Expirado";
  return "Pendente";
}

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: ownMembership }, { data: memberRows }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).single(),
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", authData.user!.id).eq("status", "active").single(),
    supabase.from("group_members").select("id, role, joined_at, user:profiles!group_members_user_id_fkey(id, name, email, avatar_url)").eq("group_id", groupId).eq("status", "active").order("joined_at"),
  ]);
  if (!group || !ownMembership) notFound();
  const isOwner = ownMembership.role === "owner";
  const members = (memberRows ?? []) as unknown as Member[];

  let invitations: Invitation[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("group_invitations")
      .select("id, email, expires_at, accepted_at, cancelled_at, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(20);
    invitations = (data ?? []) as Invitation[];
  }

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name, href: `/app/groups/${groupId}` }, { label: "Membros" }]} />
      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight">Membros</h1>
        <p className="mt-2 text-[var(--muted)]">{members.length} {members.length === 1 ? "pessoa ativa" : "pessoas ativas"}</p>
      </div>
      <GroupTabs groupId={groupId} active="members" />
      {isOwner && (
        <section className="mb-6 mt-8 rounded-2xl border bg-[var(--surface)] p-6">
          <h2 className="font-bold">Convidar por e-mail</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">O link será válido por 5 minutos e somente para o e-mail informado.</p>
          <InvitationForm groupId={groupId} />
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border bg-[var(--surface)]">
        <ul className="divide-y">
          {members.map((member) => (
            <li key={member.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{member.user?.name ?? "Usuário"}</p>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--muted)]">{member.role === "owner" ? "Proprietário" : "Membro"}</span>
                </div>
                <p className="truncate text-sm text-[var(--muted)]">{member.user?.email}</p>
              </div>
              {isOwner && member.role !== "owner" && (
                <ActionForm
                  action={removeMember}
                  submitLabel="Remover"
                  pendingLabel="Removendo…"
                  confirmMessage="Remover este membro do grupo?"
                  buttonClassName="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-60"
                >
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="membershipId" value={member.id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Convites recentes</h2>
          {invitations.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-[var(--surface)]">
              <ul className="divide-y">
                {invitations.map((invitation) => {
                  const status = invitationStatus(invitation);
                  const canManage = status === "Pendente" || status === "Expirado";
                  return (
                    <li key={invitation.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{invitation.email}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{status}</p>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <ActionForm
                            action={resendInvitation}
                            submitLabel="Reenviar"
                            pendingLabel="Reenviando…"
                            buttonClassName="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--surface-muted)] disabled:opacity-60"
                          >
                            <input type="hidden" name="groupId" value={groupId} />
                            <input type="hidden" name="invitationId" value={invitation.id} />
                          </ActionForm>
                          {status === "Pendente" && (
                            <ActionForm
                              action={cancelInvitation}
                              submitLabel="Cancelar"
                              pendingLabel="Cancelando…"
                              confirmMessage="Cancelar este convite?"
                              buttonClassName="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-60"
                            >
                              <input type="hidden" name="groupId" value={groupId} />
                              <input type="hidden" name="invitationId" value={invitation.id} />
                            </ActionForm>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">Nenhum convite enviado.</p>
          )}
        </section>
      )}
    </main>
  );
}
