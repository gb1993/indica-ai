"use client";

import { useState } from "react";

import {
  deleteContentMessage,
  updateContentMessage,
} from "@/app/app/groups/[groupId]/contents/actions";

import { ActionForm } from "./action-form";
import { AppIcon } from "./app-icon";

export function ContentMessageActions({
  groupId,
  contentId,
  messageId,
  content,
}: {
  groupId: string;
  contentId: string;
  messageId: string;
  content: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="mt-4 border-t pt-4">
        <ActionForm
          action={updateContentMessage}
          submitLabel="Salvar edição"
          pendingLabel="Salvando…"
          onSuccess={() => setEditing(false)}
          className="space-y-2"
          buttonClassName="rounded-lg border bg-(--surface) px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="contentId" value={contentId} />
          <input type="hidden" name="messageId" value={messageId} />
          <label htmlFor={`message-${messageId}`} className="sr-only">Editar mensagem</label>
          <textarea
            id={`message-${messageId}`}
            name="content"
            required
            autoFocus
            maxLength={2000}
            rows={2}
            defaultValue={content}
            className="app-input resize-y text-sm"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="ml-2 rounded-lg px-3 py-2 text-sm text-(--muted) hover:bg-(--surface)"
          >
            Cancelar
          </button>
        </ActionForm>
      </div>
    );
  }

  return (
    <div className="mt-3 flex justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar mensagem"
        title="Editar mensagem"
        className="grid size-9 place-items-center rounded-lg text-(--muted) hover:bg-(--surface) hover:text-(--foreground)"
      >
        <AppIcon name="pencil" className="size-4" />
      </button>
      <ActionForm
        action={deleteContentMessage}
        submitLabel={<AppIcon name="trash" className="size-4" />}
        pendingLabel="…"
        submitAriaLabel="Excluir mensagem"
        submitTitle="Excluir mensagem"
        confirmMessage="Excluir esta mensagem? Ela continuará aparecendo como removida."
        buttonClassName="grid size-9 place-items-center rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-60"
      >
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="contentId" value={contentId} />
        <input type="hidden" name="messageId" value={messageId} />
      </ActionForm>
    </div>
  );
}
