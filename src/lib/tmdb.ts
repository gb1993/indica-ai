import { z } from "zod";

import type { ContentType } from "./content";

const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const DOCUMENTARY_GENRE_ID = 99;

const tmdbEnvSchema = z.object({
  TMDB_API_KEY: z.string().min(1),
});

const searchItemSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  overview: z.string().default(""),
  poster_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  genre_ids: z.array(z.number().int()).default([]),
  popularity: z.number().default(0),
});

const searchResponseSchema = z.object({
  results: z.array(searchItemSchema),
});

const detailsSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  name: z.string().optional(),
  overview: z.string().default(""),
  poster_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  genres: z.array(z.object({ id: z.number().int(), name: z.string() })).default([]),
});

const videosSchema = z.object({
  results: z.array(z.object({
    key: z.string(),
    site: z.string(),
    type: z.string(),
    official: z.boolean().default(false),
  })).default([]),
});

export type TmdbMediaType = "movie" | "tv";

export type TmdbSearchResult = {
  tmdbId: number;
  mediaType: TmdbMediaType;
  type: ContentType;
  title: string;
  originalTitle: string | null;
  description: string;
  thumbnailUrl: string | null;
  year: string | null;
  popularity: number;
};

export type TmdbContentDetails = Omit<TmdbSearchResult, "originalTitle" | "popularity"> & {
  trailerUrl: string | null;
};

export type TmdbRecommendationSection = {
  id: "trending" | "popular" | "top-rated";
  title: string;
  description: string;
  items: TmdbSearchResult[];
  unavailable: boolean;
};

const RECOMMENDATION_SECTIONS: Array<{
  id: TmdbRecommendationSection["id"];
  title: string;
  description: string;
  path: string;
}> = [
  {
    id: "trending",
    title: "Em alta",
    description: "Os filmes que mais movimentaram a semana.",
    path: "/trending/movie/week",
  },
  {
    id: "popular",
    title: "Populares",
    description: "Os títulos mais procurados no momento.",
    path: "/movie/popular",
  },
  {
    id: "top-rated",
    title: "Mais bem avaliados",
    description: "Os favoritos do público no TMDB.",
    path: "/movie/top_rated",
  },
];

function apiKey() {
  return tmdbEnvSchema.parse({
    TMDB_API_KEY: process.env.TMDB_API_KEY,
  }).TMDB_API_KEY;
}

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${TMDB_API_URL}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url;
}

async function fetchJson(url: URL, cache: RequestCache = "no-store") {
  const response = await fetch(url, {
    cache,
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`TMDB request failed with status ${response.status}`);
  return response.json() as Promise<unknown>;
}

function imageUrl(path: string | null | undefined) {
  return path ? `${TMDB_IMAGE_URL}${path}` : null;
}

function yearFrom(date: string | undefined) {
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : null;
}

function contentType(mediaType: TmdbMediaType, genreIds: number[]): ContentType {
  if (genreIds.includes(DOCUMENTARY_GENRE_ID)) return "documentary";
  return mediaType === "tv" ? "series" : "movie";
}

async function searchByMediaType(query: string, mediaType: TmdbMediaType) {
  const payload = searchResponseSchema.parse(await fetchJson(buildUrl(
    `/search/${mediaType}`,
    {
      query,
      language: "pt-BR",
      include_adult: "false",
      page: "1",
    },
  )));

  return payload.results
    .filter((item) => Boolean(item.title ?? item.name))
    .map<TmdbSearchResult>((item) => ({
      tmdbId: item.id,
      mediaType,
      type: contentType(mediaType, item.genre_ids),
      title: (item.title ?? item.name)!,
      originalTitle: (item.original_title ?? item.original_name) || null,
      description: item.overview,
      thumbnailUrl: imageUrl(item.poster_path),
      year: yearFrom(item.release_date ?? item.first_air_date),
      popularity: item.popularity,
    }));
}

function toSearchResult(
  item: z.infer<typeof searchItemSchema>,
  mediaType: TmdbMediaType,
): TmdbSearchResult | null {
  const title = item.title ?? item.name;
  if (!title) return null;

  return {
    tmdbId: item.id,
    mediaType,
    type: contentType(mediaType, item.genre_ids),
    title,
    originalTitle: (item.original_title ?? item.original_name) || null,
    description: item.overview,
    thumbnailUrl: imageUrl(item.poster_path),
    year: yearFrom(item.release_date ?? item.first_air_date),
    popularity: item.popularity,
  };
}

async function getRecommendationSection(
  definition: (typeof RECOMMENDATION_SECTIONS)[number],
): Promise<TmdbRecommendationSection> {
  const payload = searchResponseSchema.parse(await fetchJson(buildUrl(
    definition.path,
    {
      language: "pt-BR",
      include_adult: "false",
      page: "1",
    },
  ), "force-cache"));

  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    items: payload.results
      .map((item) => toSearchResult(item, "movie"))
      .filter((item): item is TmdbSearchResult => item !== null)
      .slice(0, 12),
    unavailable: false,
  };
}

export async function getTmdbRecommendations(): Promise<TmdbRecommendationSection[]> {
  const responses = await Promise.allSettled(
    RECOMMENDATION_SECTIONS.map(getRecommendationSection),
  );

  return responses.map((response, index) => {
    if (response.status === "fulfilled") return response.value;
    const definition = RECOMMENDATION_SECTIONS[index];
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      items: [],
      unavailable: true,
    };
  });
}

export async function searchTmdb(query: string): Promise<TmdbSearchResult[]> {
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 80) return [];

  const responses = await Promise.allSettled([
    searchByMediaType(normalizedQuery, "movie"),
    searchByMediaType(normalizedQuery, "tv"),
  ]);
  const successful = responses
    .filter((response): response is PromiseFulfilledResult<TmdbSearchResult[]> =>
      response.status === "fulfilled")
    .flatMap((response) => response.value);

  if (!successful.length && responses.every((response) => response.status === "rejected")) {
    throw new Error("TMDB search unavailable");
  }

  return successful
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10);
}

export async function getTmdbDetails(
  mediaType: TmdbMediaType,
  tmdbId: number,
): Promise<TmdbContentDetails> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new Error("Invalid TMDB id");

  const baseParams = { language: "pt-BR" };
  const [detailsPayload, videosPayload] = await Promise.all([
    fetchJson(buildUrl(`/${mediaType}/${tmdbId}`, baseParams), "force-cache"),
    fetchJson(buildUrl(`/${mediaType}/${tmdbId}/videos`, {
      ...baseParams,
      include_video_language: "pt-BR,en-US,null",
    }), "force-cache").catch(() => ({ results: [] })),
  ]);
  const details = detailsSchema.parse(detailsPayload);
  const videos = videosSchema.parse(videosPayload).results;
  const title = details.title ?? details.name;
  if (!title) throw new Error("TMDB content has no title");

  const trailer = videos
    .filter((video) => video.site === "YouTube" && video.type === "Trailer")
    .sort((a, b) => Number(b.official) - Number(a.official))[0];

  return {
    tmdbId: details.id,
    mediaType,
    type: contentType(mediaType, details.genres.map((genre) => genre.id)),
    title,
    description: details.overview,
    thumbnailUrl: imageUrl(details.poster_path),
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    year: yearFrom(details.release_date ?? details.first_air_date),
  };
}
