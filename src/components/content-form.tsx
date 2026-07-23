"use client";

import { useState } from "react";

import {
  createContent,
  updateContent,
} from "@/app/app/groups/[groupId]/contents/actions";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_META,
  type ContentType,
} from "@/lib/content";

import { ActionForm } from "./action-form";

type EditableContent = {
  id: string;
  type: ContentType;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  trailer_url: string | null;
};

export function ContentForm({
  groupId,
  content,
}: {
  groupId: string;
  content?: EditableContent;
}) {
  const [type, setType] = useState<ContentType>(content?.type ?? "movie");
  const editing = Boolean(content);

  return (
    <ActionForm
      action={editing ? updateContent : createContent}
      submitLabel={editing ? "Salvar alterações" : "Cadastrar conteúdo"}
      pendingLabel={editing ? "Salvando…" : "Cadastrando…"}
      className="space-y-5"
      buttonClassName="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
    >
      <input type="hidden" name="groupId" value={groupId} />
      {content ? <input type="hidden" name="contentId" value={content.id} /> : null}

      <div>
        <label htmlFor="content-type" className="mb-2 block text-sm font-medium">Tipo</label>
        <select
          id="content-type"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as ContentType)}
          className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3"
        >
          {CONTENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {CONTENT_TYPE_META[value].icon} {CONTENT_TYPE_META[value].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="content-title" className="mb-2 block text-sm font-medium">Título</label>
        <input id="content-title" name="title" required maxLength={160} defaultValue={content?.title} className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3" />
      </div>

      <div>
        <label htmlFor="content-description" className="mb-2 block text-sm font-medium">Descrição <span className="text-[var(--muted)]">(opcional)</span></label>
        <textarea id="content-description" name="description" maxLength={4000} rows={6} defaultValue={content?.description ?? ""} className="w-full resize-y rounded-xl border bg-[var(--surface-muted)] px-4 py-3" />
        <p className="mt-1.5 text-xs text-[var(--muted)]">Use somente texto, sem HTML.</p>
      </div>

      <div>
        <label htmlFor="thumbnail-url" className="mb-2 block text-sm font-medium">URL da thumbnail <span className="text-[var(--muted)]">(opcional)</span></label>
        <input id="thumbnail-url" name="thumbnailUrl" type="url" maxLength={2048} pattern="https://.*" placeholder="https://…" defaultValue={content?.thumbnail_url ?? ""} className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3" />
      </div>

      {type !== "book" ? (
        <div>
          <label htmlFor="trailer-url" className="mb-2 block text-sm font-medium">Trailer no YouTube <span className="text-[var(--muted)]">(opcional)</span></label>
          <input
            key={content?.trailer_url ?? "new-trailer"}
            id="trailer-url"
            name="trailerUrl"
            type="url"
            maxLength={2048}
            pattern="https://.*"
            placeholder="https://www.youtube.com/watch?v=…"
            defaultValue={content?.trailer_url ? `https://www.youtube.com/watch?v=${content.trailer_url}` : ""}
            className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3"
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">Aceitamos links HTTPS do YouTube.</p>
        </div>
      ) : null}
    </ActionForm>
  );
}
