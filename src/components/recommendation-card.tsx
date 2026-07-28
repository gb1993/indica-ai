"use client";

import { useState } from "react";

import { createContent } from "@/app/app/groups/[groupId]/contents/actions";
import { CONTENT_TYPE_META } from "@/lib/content";
import type { TmdbSearchResult } from "@/lib/tmdb";

import { ActionForm } from "./action-form";
import { ContentThumbnail } from "./content-thumbnail";
import { Modal } from "./modal";

type RecommendationGroup = {
  id: string;
  name: string;
};

export function RecommendationCard({
  item,
  groups,
  sectionId,
}: {
  item: TmdbSearchResult;
  groups: RecommendationGroup[];
  sectionId: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const formId = `recommend-${sectionId}-${item.mediaType}-${item.tmdbId}`;

  return (
    <>
      <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-(--surface) shadow-sm transition hover:-translate-y-1 hover:border-(--accent)/45 hover:shadow-xl hover:shadow-violet-950/10">
        <div className="relative aspect-2/3 overflow-hidden bg-(--surface-muted)">
          <ContentThumbnail
            src={item.thumbnailUrl}
            alt={`Capa de ${item.title}`}
            title={item.title}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/80 to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[0.68rem] font-bold text-white backdrop-blur">
            {CONTENT_TYPE_META[item.type].label}{item.year ? ` · ${item.year}` : ""}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 font-bold leading-snug">{item.title}</h3>
          {item.description ? (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-(--muted)">
              {item.description}
            </p>
          ) : (
            <p className="mt-2 text-xs text-(--muted)">Sinopse não disponível.</p>
          )}

          {groups.length ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="app-button-secondary mt-auto min-h-10 w-full px-3 py-2 text-xs"
            >
              Indicar para um grupo
            </button>
          ) : (
            <p className="mt-auto pt-4 text-xs text-(--muted)">
              Crie ou entre em um grupo para indicar.
            </p>
          )}
        </div>
      </article>

      {groups.length ? (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Indicar “${item.title}”`}
          description="Escolha o grupo que receberá esta indicação."
        >
          <ActionForm
            action={createContent}
            submitLabel="Confirmar indicação"
            pendingLabel="Indicando…"
            className="grid grid-cols-2 gap-3"
            buttonClassName="app-button-primary min-h-11 w-full disabled:opacity-60"
          >
            <input type="hidden" name="sourceMode" value="tmdb" />
            <input type="hidden" name="tmdbId" value={item.tmdbId} />
            <input type="hidden" name="tmdbMediaType" value={item.mediaType} />
            <fieldset className="col-span-2">
              <legend className="mb-3 text-sm font-semibold">Seus grupos</legend>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {groups.map((group, index) => {
                  const optionId = `${formId}-${group.id}`;
                  return (
                    <label
                      key={group.id}
                      htmlFor={optionId}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border bg-(--surface-muted) p-3.5 transition hover:border-(--accent)/60 hover:bg-(--accent-soft)"
                    >
                      <input
                        id={optionId}
                        type="radio"
                        name="groupId"
                        value={group.id}
                        required
                        defaultChecked={index === 0}
                        className="size-4 shrink-0 accent-(--accent)"
                      />
                      <span className="min-w-0 truncate text-sm font-semibold">{group.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="app-button-secondary min-h-11 w-full"
            >
              Cancelar
            </button>
          </ActionForm>
        </Modal>
      ) : null}
    </>
  );
}
