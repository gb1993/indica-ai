import Link from "next/link";

import {
  CONTENT_STATUS_META,
  CONTENT_TYPE_META,
  type ContentStatus,
  type ContentType,
} from "@/lib/content";

import { ContentThumbnail } from "./content-thumbnail";

export type ContentCardData = {
  id: string;
  group_id: string;
  type: ContentType;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: ContentStatus;
};

export function ContentCard({ content, eager = false }: { content: ContentCardData; eager?: boolean }) {
  const type = CONTENT_TYPE_META[content.type];

  return (
    <Link
      href={`/app/groups/${content.group_id}/contents/${content.id}`}
      className="group overflow-hidden rounded-2xl border bg-[var(--surface)] transition hover:border-[var(--accent)] hover:brightness-95"
    >
      <div className="relative aspect-video overflow-hidden bg-[var(--surface-muted)]">
        <ContentThumbnail src={content.thumbnail_url} alt={`Capa de ${content.title}`} title={content.title} eager={eager} />
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1">
            <span aria-hidden>{type.icon}</span> {type.label}
          </span>
          <span className="text-[var(--muted)]">{CONTENT_STATUS_META[content.status].label}</span>
        </div>
        <h3 className="mt-3 line-clamp-2 font-bold group-hover:text-[var(--accent-strong)]">{content.title}</h3>
        {content.description ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">{content.description}</p> : null}
      </div>
    </Link>
  );
}
