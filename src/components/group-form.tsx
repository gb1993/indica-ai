import { createGroup, updateGroup } from "@/app/app/groups/actions";

import { ActionForm } from "./action-form";

export function GroupForm({ group }: { group?: { id: string; name: string; description: string | null } }) {
  return (
    <ActionForm
      action={group ? updateGroup : createGroup}
      submitLabel={group ? "Salvar alterações" : "Criar grupo"}
      pendingLabel={group ? "Salvando…" : "Criando…"}
      className="space-y-5"
      buttonClassName={`${group ? "" : "w-full"} rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c] transition disabled:opacity-60`}
    >
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
      <div>
        <label htmlFor="group-name" className="mb-2 block text-sm font-medium">Nome</label>
        <input id="group-name" name="name" required minLength={2} maxLength={80} defaultValue={group?.name} className="w-full rounded-xl border bg-(--surface-muted) px-4 py-3" placeholder="Clube do sofá" />
      </div>
      <div>
        <label htmlFor="group-description" className="mb-2 block text-sm font-medium">Descrição <span className="text-(--muted)">(opcional)</span></label>
        <textarea id="group-description" name="description" maxLength={500} rows={4} defaultValue={group?.description ?? ""} className="w-full resize-y rounded-xl border bg-(--surface-muted) px-4 py-3" placeholder="O que une este grupo?" />
      </div>
    </ActionForm>
  );
}
