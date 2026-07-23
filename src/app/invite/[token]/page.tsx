import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptInvitation } from "@/app/app/groups/actions";
import { ActionForm } from "@/components/action-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aceitar convite" };

type InvitationPreview = {
  invitation_id: string;
  group_id: string;
  group_name: string;
  invited_email: string;
  expires_at: string;
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect(`/?next=${encodeURIComponent(`/invite/${token}`)}`);

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data } = await supabase.rpc("get_group_invitation", { p_token_hash: tokenHash });
  const invitation = ((data ?? []) as InvitationPreview[])[0];

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border bg-(--surface) p-8 text-center shadow-2xl shadow-black/15">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-(--accent) text-xl font-black text-[#07150c]">AÍ</div>
        {invitation ? (
          <>
            <p className="text-sm font-semibold text-(--accent-strong)">Convite para grupo</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{invitation.group_name}</h1>
            <p className="mt-4 text-(--muted)">Este convite está vinculado a <strong className="text-(--foreground)">{invitation.invited_email}</strong> e expira em até 5 minutos.</p>
            <ActionForm
              action={acceptInvitation}
              submitLabel="Aceitar e entrar no grupo"
              pendingLabel="Aceitando…"
              className="mt-7 space-y-3"
              buttonClassName="w-full rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c] transition disabled:opacity-60"
            >
              <input type="hidden" name="token" value={token} />
            </ActionForm>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Convite indisponível</h1>
            <p className="mt-3 text-(--muted)">O convite expirou, foi cancelado, já foi usado ou pertence a outro e-mail.</p>
            <Link href="/dashboard" className="mt-7 inline-block cursor-pointer rounded-xl border px-5 py-3 text-sm font-semibold transition hover:brightness-90">Ir para meus grupos</Link>
          </>
        )}
      </section>
    </main>
  );
}
