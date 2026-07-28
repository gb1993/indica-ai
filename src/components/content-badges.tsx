import {
  CONTENT_STATUS_META,
  CONTENT_TYPE_META,
  type ContentStatus,
  type ContentType,
} from "@/lib/content";

import { AppIcon, type AppIconName } from "./app-icon";

const contentTypeIcons: Record<ContentType, AppIconName> = {
  movie: "film",
  series: "tv",
  documentary: "video",
};

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-(--surface-muted) px-2.5 py-1 text-xs">
      <AppIcon name={contentTypeIcons[type]} className="size-3.5" />
      {meta.label}
    </span>
  );
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className="rounded-full border px-2.5 py-1 text-xs text-(--muted)">{CONTENT_STATUS_META[status].label}</span>;
}
