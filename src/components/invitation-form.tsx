import { sendInvitation } from "@/app/app/groups/actions";

import { ActionForm } from "./action-form";

export function InvitationForm({ groupId }: { groupId: string }) {
  return (
    <ActionForm
      action={sendInvitation}
      submitLabel="Enviar convite"
      pendingLabel="Enviando…"
      resetOnSuccess
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
      buttonClassName="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[#07150c] disabled:opacity-60"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <label htmlFor="invite-email" className="sr-only">E-mail do convidado</label>
      <input id="invite-email" name="email" type="email" required maxLength={254} placeholder="amigo@exemplo.com" className="min-w-0 flex-1 rounded-xl border bg-[var(--surface-muted)] px-4 py-3" />
    </ActionForm>
  );
}
