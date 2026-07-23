import {
  CONTENT_STATUS_META,
  CONTENT_TYPE_META,
  type ContentStatus,
  type ContentType,
} from "@/lib/content";

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  return <span className="rounded-full bg-(--surface-muted) px-2.5 py-1 text-xs"><span aria-hidden>{meta.icon}</span> {meta.label}</span>;
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className="rounded-full border px-2.5 py-1 text-xs text-(--muted)">{CONTENT_STATUS_META[status].label}</span>;
}
