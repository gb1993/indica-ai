import { createContent } from "@/app/app/groups/[groupId]/contents/actions";
import { CONTENT_TYPE_META } from "@/lib/content";
import type { TmdbSearchResult } from "@/lib/tmdb";

import { ActionForm } from "./action-form";
import { ContentThumbnail } from "./content-thumbnail";

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
  const formId = `recommend-${sectionId}-${item.mediaType}-${item.tmdbId}`;

  return (
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
          <details className="mt-auto pt-4">
            <summary className="app-button-secondary flex min-h-10 list-none justify-center px-3 py-2 text-xs">
              Indicar para um grupo
            </summary>
            <ActionForm
              action={createContent}
              submitLabel="Confirmar indicação"
              pendingLabel="Indicando…"
              className="mt-3 space-y-2"
              buttonClassName="app-button-primary min-h-10 w-full px-3 py-2 text-xs disabled:opacity-60"
            >
              <input type="hidden" name="sourceMode" value="tmdb" />
              <input type="hidden" name="tmdbId" value={item.tmdbId} />
              <input type="hidden" name="tmdbMediaType" value={item.mediaType} />
              <label htmlFor={formId} className="sr-only">Escolha o grupo</label>
              <select id={formId} name="groupId" required className="app-input py-2 text-xs">
                <option value="">Escolha o grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </ActionForm>
          </details>
        ) : (
          <p className="mt-auto pt-4 text-xs text-(--muted)">
            Crie ou entre em um grupo para indicar.
          </p>
        )}
      </div>
    </article>
  );
}
