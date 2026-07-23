import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/action-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContentStatusBadge, ContentTypeBadge } from "@/components/content-badges";
import { ContentForm } from "@/components/content-form";
import { ContentRatingForm } from "@/components/content-rating-form";
import { ContentThumbnail } from "@/components/content-thumbnail";
import {
  type ContentStatus,
  type ContentType,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

import {
  completeContent,
  createContentMessage,
  deleteContentMessage,
  deleteContent,
  getContentRatingSummary,
  getContentVoteSummary,
  setContentVote,
  updateContentMessage,
} from "../actions";

export const metadata: Metadata = { title: "Detalhes do conteúdo" };

type ContentDetails = {
  id: string;
  group_id: string;
  created_by: string;
  type: ContentType;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  trailer_url: string | null;
  status: ContentStatus;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  creator: { name: string } | null;
  completer: { name: string } | null;
};

type ContentMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author: { name: string } | null;
};

const MESSAGES_PER_PAGE = 10;

export default async function ContentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; contentId: string }>;
  searchParams: Promise<{ messagesPage?: string }>;
}) {
  const { groupId, contentId } = await params;
  const requestedPage = Number((await searchParams).messagesPage ?? "1");
  const messagesPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const messagesFrom = (messagesPage - 1) * MESSAGES_PER_PAGE;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [
    { data: group },
    { data: contentRow },
    voteSummary,
    ratingSummary,
    { data: messageRows, count: messageCount, error: messagesError },
  ] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).single(),
    supabase
      .from("contents")
      .select("id, group_id, created_by, type, title, description, thumbnail_url, trailer_url, status, completed_at, completed_by, created_at, creator:profiles!contents_created_by_fkey(name), completer:profiles!contents_completed_by_fkey(name)")
      .eq("id", contentId)
      .eq("group_id", groupId)
      .single(),
    getContentVoteSummary(contentId),
    getContentRatingSummary(contentId),
    supabase
      .from("content_messages")
      .select("id, user_id, content, created_at, updated_at, deleted_at, author:profiles!content_messages_user_id_fkey(name)", { count: "exact" })
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .range(messagesFrom, messagesFrom + MESSAGES_PER_PAGE - 1),
  ]);

  if (!group || !contentRow || !voteSummary || !ratingSummary) notFound();
  const content = contentRow as unknown as ContentDetails;
  const canManage = content.status === "pending" && content.created_by === authData.user?.id;
  const messages = (messageRows ?? []) as unknown as ContentMessage[];
  const totalMessagePages = Math.max(1, Math.ceil((messageCount ?? 0) / MESSAGES_PER_PAGE));

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: group.name, href: `/app/groups/${groupId}` }, { label: content.title }]} />

      <article className="mt-6 overflow-hidden rounded-3xl border bg-(--surface)">
        <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="relative min-h-72 bg-(--surface-muted) md:min-h-120">
            <ContentThumbnail src={content.thumbnail_url} alt={`Capa de ${content.title}`} title={content.title} eager />
          </div>
          <div className="p-7 sm:p-9">
            <div className="flex flex-wrap gap-2 text-xs">
              <ContentTypeBadge type={content.type} />
              <ContentStatusBadge status={content.status} />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{content.title}</h1>
            {content.description ? <p className="mt-5 whitespace-pre-wrap leading-relaxed text-(--muted)">{content.description}</p> : null}
            <dl className="mt-7 space-y-2 border-t pt-5 text-sm text-(--muted)">
              <div className="flex justify-between gap-4">
                <dt>Indicado por</dt>
                <dd className="font-medium text-(--foreground)">{content.creator?.name ?? "Membro"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Cadastrado em</dt>
                <dd className="font-medium text-(--foreground)">{new Intl.DateTimeFormat("pt-BR").format(new Date(content.created_at))}</dd>
              </div>
              {content.completed_at ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt>Concluído em</dt>
                    <dd className="font-medium text-(--foreground)">{new Intl.DateTimeFormat("pt-BR").format(new Date(content.completed_at))}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Concluído por</dt>
                    <dd className="font-medium text-(--foreground)">{content.completer?.name ?? "Membro"}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </div>
        </div>
      </article>

      <section className="mt-8 rounded-3xl border bg-(--surface) p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-xl font-bold">Votação</h2>
            <p className="mt-1 text-sm text-(--muted)">
              {voteSummary.content_status === "pending"
                ? "A maioria dos membros ativos precisa votar favoravelmente."
                : "Conteúdo aprovado pela maioria do grupo."}
            </p>
          </div>
          <span className="w-fit rounded-full border px-3 py-1.5 text-xs font-semibold">
            {voteSummary.content_status === "pending" ? "Votação aberta" : "Aprovado"}
          </span>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-(--surface-muted) p-4">
            <dt className="text-xs text-(--muted)">Favoráveis</dt>
            <dd className="mt-1 text-2xl font-bold">{voteSummary.favorable_votes}</dd>
          </div>
          <div className="rounded-2xl bg-(--surface-muted) p-4">
            <dt className="text-xs text-(--muted)">Contrários</dt>
            <dd className="mt-1 text-2xl font-bold">{voteSummary.contrary_votes}</dd>
          </div>
          <div className="rounded-2xl bg-(--surface-muted) p-4">
            <dt className="text-xs text-(--muted)">Membros ativos</dt>
            <dd className="mt-1 text-2xl font-bold">{voteSummary.active_members}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-2xl border p-4 text-sm">
          <p>
            Seu voto: <strong>{voteSummary.current_user_vote === null
              ? "Ainda não votou"
              : voteSummary.current_user_vote
                ? "Favorável"
                : "Contrário"}</strong>
          </p>
          {voteSummary.content_status === "pending" ? (
            <p className="mt-1 text-(--muted)">
              {voteSummary.favorable_votes_needed === 1
                ? "Falta 1 voto favorável para aprovação."
                : `Faltam ${voteSummary.favorable_votes_needed} votos favoráveis para aprovação.`}
            </p>
          ) : (
            <p className="mt-1 text-(--muted)">A votação está encerrada e os votos são somente para leitura.</p>
          )}
        </div>

        {voteSummary.content_status === "pending" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActionForm
              action={setContentVote}
              submitLabel={voteSummary.current_user_vote === true ? "Favorável — seu voto" : "Votar favorável"}
              pendingLabel="Registrando…"
              className="space-y-2"
              buttonClassName="w-full rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
            >
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="contentId" value={content.id} />
              <input type="hidden" name="vote" value="true" />
            </ActionForm>
            <ActionForm
              action={setContentVote}
              submitLabel={voteSummary.current_user_vote === false ? "Contrário — seu voto" : "Votar contrário"}
              pendingLabel="Registrando…"
              className="space-y-2"
              buttonClassName="w-full rounded-xl border bg-(--surface-muted) px-5 py-3 font-bold disabled:opacity-60"
            >
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="contentId" value={content.id} />
              <input type="hidden" name="vote" value="false" />
            </ActionForm>
          </div>
        ) : null}
      </section>

      {content.status === "approved" ? (
        <section className="mt-8 rounded-3xl border bg-(--surface) p-6 sm:p-8">
          <h2 className="text-xl font-bold">Concluir conteúdo</h2>
          <p className="mt-2 text-sm text-(--muted)">
            Qualquer membro ativo pode informar que este {content.type === "book" ? "livro foi lido" : "conteúdo foi assistido"}.
          </p>
          <ActionForm
            action={completeContent}
            submitLabel={content.type === "book" ? "Marcar como lido" : "Marcar como assistido"}
            pendingLabel="Concluindo…"
            confirmMessage={`Confirmar que este conteúdo foi ${content.type === "book" ? "lido" : "assistido"}?`}
            className="mt-5 space-y-3"
            buttonClassName="rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
          >
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="contentId" value={content.id} />
          </ActionForm>
        </section>
      ) : null}

      {content.status === "completed" ? (
        <section className="mt-8 rounded-3xl border bg-(--surface) p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-xl font-bold">Avaliações</h2>
              <p className="mt-1 text-sm text-(--muted)">Avalie este conteúdo de 1 a 5 estrelas.</p>
            </div>
            <div className="rounded-2xl bg-(--surface-muted) px-5 py-3 text-right">
              <p className="text-2xl font-bold" aria-label={ratingSummary.average_rating === null ? "Sem avaliações" : `Média ${ratingSummary.average_rating.toFixed(1)} de 5`}>
                {ratingSummary.average_rating === null ? "—" : `${ratingSummary.average_rating.toFixed(1)} ★`}
              </p>
              <p className="text-xs text-(--muted)">
                {ratingSummary.rating_count} {ratingSummary.rating_count === 1 ? "avaliação" : "avaliações"}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t pt-6">
            <ContentRatingForm
              groupId={groupId}
              contentId={content.id}
              currentRating={ratingSummary.current_user_rating}
            />
          </div>
        </section>
      ) : null}

      {content.trailer_url ? (
        <section className="mt-8 rounded-3xl border bg-(--surface) p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Trailer</h2>
            <a href={youtubeWatchUrl(content.trailer_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-(--accent-strong) hover:underline">Abrir no YouTube</a>
          </div>
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={youtubeEmbedUrl(content.trailer_url)}
              title={`Trailer de ${content.title}`}
              className="size-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border bg-(--surface) p-6 sm:p-8">
        <div>
          <h2 className="text-xl font-bold">Conversa</h2>
          <p className="mt-1 text-sm text-(--muted)">Esta conversa é privada para os membros ativos do grupo.</p>
        </div>

        <ActionForm
          action={createContentMessage}
          submitLabel="Publicar mensagem"
          pendingLabel="Publicando…"
          resetOnSuccess
          className="mt-6 space-y-3"
          buttonClassName="rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
        >
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="contentId" value={content.id} />
          <label htmlFor="new-message" className="sr-only">Nova mensagem</label>
          <textarea
            id="new-message"
            name="content"
            required
            maxLength={2000}
            rows={4}
            placeholder="Escreva uma mensagem…"
            className="w-full resize-y rounded-xl border bg-(--surface-muted) px-4 py-3"
          />
        </ActionForm>

        <div className="mt-8 border-t pt-6">
          {messagesError ? (
            <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">Não foi possível carregar as mensagens.</p>
          ) : messages.length ? (
            <ul className="space-y-4">
              {messages.map((message) => {
                const isAuthor = message.user_id === authData.user?.id;
                const wasEdited = !message.deleted_at
                  && new Date(message.updated_at).getTime() > new Date(message.created_at).getTime();
                return (
                  <li key={message.id} className="rounded-2xl border bg-(--surface-muted) p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-(--muted)">
                      <span className="font-semibold text-(--foreground)">{message.author?.name ?? "Membro"}</span>
                      <time dateTime={message.created_at}>
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(message.created_at))}
                      </time>
                    </div>
                    {message.deleted_at ? (
                      <p className="mt-3 italic text-(--muted)">Mensagem removida</p>
                    ) : (
                      <>
                        <p className="mt-3 whitespace-pre-wrap wrap-break-word">{message.content}</p>
                        {wasEdited ? <p className="mt-2 text-xs text-(--muted)">Editada</p> : null}
                        {isAuthor ? (
                          <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto]">
                            <ActionForm
                              action={updateContentMessage}
                              submitLabel="Salvar edição"
                              pendingLabel="Salvando…"
                              className="space-y-2"
                              buttonClassName="rounded-lg border bg-(--surface) px-3 py-2 text-sm font-semibold disabled:opacity-60"
                            >
                              <input type="hidden" name="groupId" value={groupId} />
                              <input type="hidden" name="contentId" value={content.id} />
                              <input type="hidden" name="messageId" value={message.id} />
                              <label htmlFor={`message-${message.id}`} className="sr-only">Editar mensagem</label>
                              <textarea id={`message-${message.id}`} name="content" required maxLength={2000} rows={2} defaultValue={message.content} className="w-full resize-y rounded-lg border bg-(--surface) px-3 py-2 text-sm" />
                            </ActionForm>
                            <ActionForm
                              action={deleteContentMessage}
                              submitLabel="Excluir"
                              pendingLabel="Excluindo…"
                              confirmMessage="Excluir esta mensagem? Ela continuará aparecendo como removida."
                              className="space-y-2"
                              buttonClassName="rounded-lg px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-60"
                            >
                              <input type="hidden" name="groupId" value={groupId} />
                              <input type="hidden" name="contentId" value={content.id} />
                              <input type="hidden" name="messageId" value={message.id} />
                            </ActionForm>
                          </div>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-(--muted)">Nenhuma mensagem ainda. Inicie a conversa.</p>
          )}

          {!messagesError && totalMessagePages > 1 ? (
            <nav aria-label="Paginação das mensagens" className="mt-6 flex items-center justify-between gap-4 text-sm">
              {messagesPage > 1 ? (
                <Link href={`?messagesPage=${messagesPage - 1}`} className="rounded-lg border px-3 py-2 hover:bg-(--surface-muted)">← Mais recentes</Link>
              ) : <span />}
              <span className="text-(--muted)">Página {Math.min(messagesPage, totalMessagePages)} de {totalMessagePages}</span>
              {messagesPage < totalMessagePages ? (
                <Link href={`?messagesPage=${messagesPage + 1}`} className="rounded-lg border px-3 py-2 hover:bg-(--surface-muted)">Mais antigas →</Link>
              ) : <span />}
            </nav>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <section className="mt-8 rounded-3xl border bg-(--surface) p-7 sm:p-9">
          <h2 className="text-2xl font-bold">Editar conteúdo</h2>
          <p className="mt-2 text-sm text-(--muted)">Você pode alterar sua indicação enquanto ela estiver aguardando aprovação.</p>
          <div className="mt-6">
            <ContentForm groupId={groupId} content={content} />
          </div>
          <div className="mt-8 border-t pt-6">
            <ActionForm
              action={deleteContent}
              submitLabel="Excluir conteúdo"
              pendingLabel="Excluindo…"
              confirmMessage="Excluir este conteúdo permanentemente?"
              className="space-y-3"
              buttonClassName="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="contentId" value={content.id} />
            </ActionForm>
          </div>
        </section>
      ) : null}
    </main>
  );
}
