import Link from "next/link";

import type { ContentStatus, ContentType } from "@/lib/content";

import { ContentStatusBadge, ContentTypeBadge } from "./content-badges";
import { ContentThumbnail } from "./content-thumbnail";

export type ContentCardData = {
  id: string;
  group_id: string;
  type: ContentType;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: ContentStatus;
  completed_at: string | null;
  average_rating: number | null;
  rating_count: number;
};

export function ContentCard({ content, eager = false }: { content: ContentCardData; eager?: boolean }) {
  return (
    <Link
      href={`/app/groups/${content.group_id}/contents/${content.id}`}
      className="group overflow-hidden rounded-2xl border bg-(--surface) transition hover:border-(--accent) hover:brightness-95"
    >
      <div className="relative aspect-video overflow-hidden bg-(--surface-muted)">
        <ContentThumbnail src={content.thumbnail_url} alt={`Capa de ${content.title}`} title={content.title} eager={eager} />
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <ContentTypeBadge type={content.type} />
          <ContentStatusBadge status={content.status} />
        </div>
        <h3 className="mt-3 line-clamp-2 font-bold group-hover:text-(--accent-strong)">{content.title}</h3>
        {content.status === "completed" ? (
          <dl className="mt-3 space-y-1.5 border-t pt-3 text-xs text-(--muted)">
            <div className="flex justify-between gap-3">
              <dt>Conclusão</dt>
              <dd className="text-(--foreground)">
                {content.completed_at
                  ? new Intl.DateTimeFormat("pt-BR").format(new Date(content.completed_at))
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Média</dt>
              <dd className="text-(--foreground)">
                {content.average_rating === null ? "Sem avaliações" : `${content.average_rating.toFixed(1)} ★`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Avaliações</dt>
              <dd className="text-(--foreground)">{content.rating_count}</dd>
            </div>
          </dl>
        ) : content.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-(--muted)">{content.description}</p>
        ) : null}
      </div>
    </Link>
  );
}
