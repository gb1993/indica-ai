export const CONTENT_TYPES = [
  "movie",
  "series",
  "documentary",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentStatus = "pending" | "approved" | "completed";

export const CONTENT_TYPE_META: Record<ContentType, { label: string }> = {
  movie: { label: "Filme" },
  series: { label: "Série" },
  documentary: { label: "Documentário" },
};

export const CONTENT_STATUS_META: Record<ContentStatus, { label: string }> = {
  pending: { label: "Aguardando aprovação" },
  approved: { label: "Próximo" },
  completed: { label: "Concluído" },
};

export function normalizeYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate: string | null = null;

    if (hostname === "youtu.be") {
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") {
        candidate = url.searchParams.get("v");
      } else {
        const [kind, id] = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(kind)) candidate = id ?? null;
      }
    }

    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
