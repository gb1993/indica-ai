"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  createContent,
  loadTmdbContentDetails,
  searchTmdbContents,
  updateContent,
} from "@/app/app/groups/[groupId]/contents/actions";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_META,
  type ContentType,
} from "@/lib/content";
import type {
  TmdbContentDetails,
  TmdbSearchResult,
} from "@/lib/tmdb";

import { ActionForm } from "./action-form";
import { ContentThumbnail } from "./content-thumbnail";

type EditableContent = {
  id: string;
  type: ContentType;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  trailer_url: string | null;
  tmdb_id?: number | null;
  tmdb_media_type?: "movie" | "tv" | null;
};

function ManualFields({
  content,
}: {
  content?: EditableContent;
}) {
  const [type, setType] = useState<ContentType>(content?.type ?? "movie");

  return (
    <>
      <div>
        <label htmlFor="content-type" className="mb-2 block text-sm font-medium">Tipo</label>
        <select
          id="content-type"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as ContentType)}
          className="app-input"
        >
          {CONTENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {CONTENT_TYPE_META[value].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="content-title" className="mb-2 block text-sm font-medium">Título</label>
        <input id="content-title" name="title" required maxLength={160} defaultValue={content?.title} className="app-input" />
      </div>

      <div>
        <label htmlFor="content-description" className="mb-2 block text-sm font-medium">Descrição <span className="text-(--muted)">(opcional)</span></label>
        <textarea id="content-description" name="description" maxLength={4000} rows={6} defaultValue={content?.description ?? ""} className="app-input resize-y" />
        <p className="mt-1.5 text-xs text-(--muted)">Use somente texto, sem HTML.</p>
      </div>

      <div>
        <label htmlFor="thumbnail-url" className="mb-2 block text-sm font-medium">URL da thumbnail <span className="text-(--muted)">(opcional)</span></label>
        <input id="thumbnail-url" name="thumbnailUrl" type="url" maxLength={2048} pattern="https://.*" placeholder="https://…" defaultValue={content?.thumbnail_url ?? ""} className="app-input" />
      </div>

      <div>
        <label htmlFor="trailer-url" className="mb-2 block text-sm font-medium">Trailer no YouTube <span className="text-(--muted)">(opcional)</span></label>
        <input
          key={content?.trailer_url ?? "new-trailer"}
          id="trailer-url"
          name="trailerUrl"
          type="url"
          maxLength={2048}
          pattern="https://.*"
          placeholder="https://www.youtube.com/watch?v=…"
          defaultValue={content?.trailer_url ? `https://www.youtube.com/watch?v=${content.trailer_url}` : ""}
          className="app-input"
        />
        <p className="mt-1.5 text-xs text-(--muted)">Aceitamos links HTTPS do YouTube.</p>
      </div>
    </>
  );
}

export function ContentForm({
  groupId,
  content,
}: {
  groupId: string;
  content?: EditableContent;
}) {
  const editing = Boolean(content);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [selected, setSelected] = useState<TmdbContentDetails | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [loadingDetails, startDetails] = useTransition();

  if (editing) {
    if (content!.tmdb_id) {
      return (
        <div className="rounded-xl border bg-(--surface-muted) p-4 text-sm text-(--muted)">
          Os metadados deste conteúdo vieram do TMDB e permanecem vinculados ao
          identificador externo. Para corrigir a indicação, exclua-a e selecione
          novamente o resultado correto.
        </div>
      );
    }

    return (
      <ActionForm
        action={updateContent}
        submitLabel="Salvar alterações"
        pendingLabel="Salvando…"
        className="space-y-5"
        buttonClassName="app-button-primary w-full disabled:opacity-60"
      >
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="contentId" value={content!.id} />
        <ManualFields content={content} />
      </ActionForm>
    );
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSelected(null);
    setManualMode(false);
    startSearch(async () => {
      const response = await searchTmdbContents(groupId, query);
      if (response.status === "error") {
        setResults([]);
        setFeedback(response.message);
        setManualMode(true);
        return;
      }
      setResults(response.results);
      if (!response.results.length) {
        setFeedback("Nenhum resultado encontrado. Preencha os dados manualmente.");
        setManualMode(true);
      }
    });
  }

  function chooseResult(result: TmdbSearchResult) {
    setFeedback(null);
    startDetails(async () => {
      const response = await loadTmdbContentDetails(
        groupId,
        result.tmdbId,
        result.mediaType,
      );
      if (response.status === "error") {
        setFeedback(response.message);
        setManualMode(true);
        return;
      }
      setSelected(response.content);
      setResults([]);
    });
  }

  return (
    <div className="space-y-6">
      {!selected && !manualMode ? (
        <>
          <form onSubmit={handleSearch} className="space-y-3">
            <label htmlFor="tmdb-query" className="block text-sm font-medium">
              Pesquise por filme, série ou documentário
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="tmdb-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                required
                minLength={2}
                maxLength={80}
                placeholder="Ex.: Duna, Ruptura, Planeta Terra"
                className="app-input"
              />
              <button type="submit" disabled={searching} className="app-button-primary shrink-0 disabled:opacity-60">
                {searching ? "Pesquisando…" : "Pesquisar"}
              </button>
            </div>
          </form>

          {results.length ? (
            <div>
              <p className="mb-3 text-sm text-(--muted)">Selecione o resultado correto:</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {results.map((result) => (
                  <li key={`${result.mediaType}-${result.tmdbId}`}>
                    <button
                      type="button"
                      disabled={loadingDetails}
                      onClick={() => chooseResult(result)}
                      className="flex h-full w-full gap-3 rounded-xl border bg-(--surface-muted) p-3 text-left disabled:opacity-60 hover:border-(--accent)"
                    >
                      <span className="relative block h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-(--surface)">
                        <ContentThumbnail
                          src={result.thumbnailUrl}
                          alt={`Capa de ${result.title}`}
                          title={result.title}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-semibold">{result.title}</span>
                        <span className="mt-1 block text-xs text-(--accent-strong)">
                          {CONTENT_TYPE_META[result.type].label}{result.year ? ` · ${result.year}` : ""}
                        </span>
                        {result.description ? (
                          <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-(--muted)">
                            {result.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  setManualMode(true);
                  setFeedback("O conteúdo desejado não estava nos resultados.");
                }}
                className="mt-4 text-sm font-semibold text-(--accent-strong) hover:underline"
              >
                Não encontrei o conteúdo
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {feedback ? (
        <p role="status" className="rounded-xl border bg-(--surface-muted) p-4 text-sm text-(--muted)">
          {feedback}
        </p>
      ) : null}

      {selected ? (
        <ActionForm
          action={createContent}
          submitLabel="Indicar este conteúdo"
          pendingLabel="Cadastrando…"
          className="space-y-5"
          buttonClassName="app-button-primary w-full disabled:opacity-60"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="sourceMode" value="tmdb" />
          <input type="hidden" name="tmdbId" value={selected.tmdbId} />
          <input type="hidden" name="tmdbMediaType" value={selected.mediaType} />
          <div className="flex gap-4 rounded-2xl border bg-(--surface-muted) p-4">
            <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-(--surface)">
              <ContentThumbnail
                src={selected.thumbnailUrl}
                alt={`Capa de ${selected.title}`}
                title={selected.title}
                eager
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--accent-strong)">
                {CONTENT_TYPE_META[selected.type].label}{selected.year ? ` · ${selected.year}` : ""}
              </p>
              <h2 className="mt-1 text-xl font-bold">{selected.title}</h2>
              {selected.description ? (
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-(--muted)">
                  {selected.description}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-(--muted)">
            Os dados serão confirmados novamente no TMDB ao cadastrar.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setFeedback(null);
            }}
            className="text-sm font-semibold text-(--accent-strong) hover:underline"
          >
            Escolher outro resultado
          </button>
        </ActionForm>
      ) : null}

      {manualMode ? (
        <>
          <ActionForm
            action={createContent}
            submitLabel="Cadastrar manualmente"
            pendingLabel="Cadastrando…"
            className="space-y-5"
            buttonClassName="app-button-primary w-full disabled:opacity-60"
          >
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="sourceMode" value="manual" />
            <ManualFields />
          </ActionForm>
          <button
            type="button"
            onClick={() => {
              setManualMode(false);
              setFeedback(null);
              setResults([]);
            }}
            className="text-sm font-semibold text-(--accent-strong) hover:underline"
          >
            Voltar para a busca no TMDB
          </button>
        </>
      ) : null}
    </div>
  );
}
