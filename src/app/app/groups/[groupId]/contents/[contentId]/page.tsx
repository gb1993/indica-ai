import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/action-form";
import { ContentForm } from "@/components/content-form";
import { ContentThumbnail } from "@/components/content-thumbnail";
import {
  CONTENT_STATUS_META,
  CONTENT_TYPE_META,
  type ContentStatus,
  type ContentType,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

import {
  deleteContent,
  getContentVoteSummary,
  setContentVote,
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
  created_at: string;
  creator: { name: string } | null;
};

export default async function ContentDetailsPage({
  params,
}: {
  params: Promise<{ groupId: string; contentId: string }>;
}) {
  const { groupId, contentId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: group }, { data: contentRow }, voteSummary] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).single(),
    supabase
      .from("contents")
      .select("id, group_id, created_by, type, title, description, thumbnail_url, trailer_url, status, completed_at, created_at, creator:profiles!contents_created_by_fkey(name)")
      .eq("id", contentId)
      .eq("group_id", groupId)
      .single(),
    getContentVoteSummary(contentId),
  ]);

  if (!group || !contentRow || !voteSummary) notFound();
  const content = contentRow as unknown as ContentDetails;
  const type = CONTENT_TYPE_META[content.type];
  const canManage = content.status === "pending" && content.created_by === authData.user?.id;

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Link href={`/app/groups/${groupId}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        ← Voltar para {group.name}
      </Link>

      <article className="mt-6 overflow-hidden rounded-3xl border bg-[var(--surface)]">
        <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="relative min-h-72 bg-[var(--surface-muted)] md:min-h-[30rem]">
            <ContentThumbnail src={content.thumbnail_url} alt={`Capa de ${content.title}`} title={content.title} eager />
          </div>
          <div className="p-7 sm:p-9">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">
                <span aria-hidden>{type.icon}</span> {type.label}
              </span>
              <span className="rounded-full border px-3 py-1.5 text-[var(--muted)]">
                {CONTENT_STATUS_META[content.status].label}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{content.title}</h1>
            {content.description ? <p className="mt-5 whitespace-pre-wrap leading-relaxed text-[var(--muted)]">{content.description}</p> : null}
            <dl className="mt-7 space-y-2 border-t pt-5 text-sm text-[var(--muted)]">
              <div className="flex justify-between gap-4">
                <dt>Indicado por</dt>
                <dd className="font-medium text-[var(--foreground)]">{content.creator?.name ?? "Membro"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Cadastrado em</dt>
                <dd className="font-medium text-[var(--foreground)]">{new Intl.DateTimeFormat("pt-BR").format(new Date(content.created_at))}</dd>
              </div>
            </dl>
          </div>
        </div>
      </article>

      <section className="mt-8 rounded-3xl border bg-[var(--surface)] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-xl font-bold">Votação</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
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
          <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">Favoráveis</dt>
            <dd className="mt-1 text-2xl font-bold">{voteSummary.favorable_votes}</dd>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">Contrários</dt>
            <dd className="mt-1 text-2xl font-bold">{voteSummary.contrary_votes}</dd>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">Membros ativos</dt>
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
            <p className="mt-1 text-[var(--muted)]">
              {voteSummary.favorable_votes_needed === 1
                ? "Falta 1 voto favorável para aprovação."
                : `Faltam ${voteSummary.favorable_votes_needed} votos favoráveis para aprovação.`}
            </p>
          ) : (
            <p className="mt-1 text-[var(--muted)]">A votação está encerrada e os votos são somente para leitura.</p>
          )}
        </div>

        {voteSummary.content_status === "pending" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActionForm
              action={setContentVote}
              submitLabel={voteSummary.current_user_vote === true ? "Favorável — seu voto" : "Votar favorável"}
              pendingLabel="Registrando…"
              className="space-y-2"
              buttonClassName="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
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
              buttonClassName="w-full rounded-xl border bg-[var(--surface-muted)] px-5 py-3 font-bold disabled:opacity-60"
            >
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="contentId" value={content.id} />
              <input type="hidden" name="vote" value="false" />
            </ActionForm>
          </div>
        ) : null}
      </section>

      {content.trailer_url ? (
        <section className="mt-8 rounded-3xl border bg-[var(--surface)] p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Trailer</h2>
            <a href={youtubeWatchUrl(content.trailer_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent-strong)] hover:underline">Abrir no YouTube</a>
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

      {canManage ? (
        <section className="mt-8 rounded-3xl border bg-[var(--surface)] p-7 sm:p-9">
          <h2 className="text-2xl font-bold">Editar conteúdo</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Você pode alterar sua indicação enquanto ela estiver aguardando aprovação.</p>
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
