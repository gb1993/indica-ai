import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptInvitation } from "@/app/app/groups/actions";
import { ActionForm } from "@/components/action-form";
import { BrandLogo } from "@/components/brand-logo";
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
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <span aria-hidden className="absolute size-[30rem] rounded-full bg-violet-600/10 blur-3xl" />
      <section className="app-auth-panel relative w-full max-w-lg p-8 text-center">
        <BrandLogo size={56} className="mx-auto mb-5" priority />
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
              buttonClassName="app-button-primary w-full disabled:opacity-60"
            >
              <input type="hidden" name="token" value={token} />
            </ActionForm>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Convite indisponível</h1>
            <p className="mt-3 text-(--muted)">O convite expirou, foi cancelado, já foi usado ou pertence a outro e-mail.</p>
            <Link href="/dashboard" className="app-button-secondary mt-7">Ir para meus grupos</Link>
          </>
        )}
      </section>
    </main>
  );
}
