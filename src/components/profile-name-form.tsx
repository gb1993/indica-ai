import { updateProfileName } from "@/app/app/profile/actions";

import { ActionForm } from "./action-form";

export function ProfileNameForm({ initialName }: { initialName: string }) {
  return (
    <ActionForm
      action={updateProfileName}
      submitLabel="Salvar nome"
      pendingLabel="Salvando…"
      className="space-y-3"
      buttonClassName="app-button-primary disabled:opacity-60"
    >
      <div>
        <label htmlFor="profile-name" className="mb-2 block text-sm font-medium">
          Nome
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          defaultValue={initialName}
          className="app-input"
        />
        <p className="mt-1.5 text-xs text-(--muted)">
          Este nome será exibido nos grupos, indicações, avaliações e mensagens.
        </p>
      </div>
    </ActionForm>
  );
}
