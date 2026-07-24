import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { getTmdbDetails, searchTmdb } from "./tmdb.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.TMDB_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.TMDB_API_KEY;
  else process.env.TMDB_API_KEY = originalApiKey;
});

test("combina filmes, documentários e séries pesquisados no TMDB", async () => {
  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("api_key"), "test-key");
    assert.equal(url.searchParams.get("language"), "pt-BR");
    if (url.pathname.endsWith("/search/movie")) {
      return Response.json({
        results: [
          { id: 1, title: "Filme", overview: "A", genre_ids: [18], popularity: 4 },
          { id: 2, title: "Doc", overview: "B", genre_ids: [99], popularity: 8 },
        ],
      });
    }
    return Response.json({
      results: [
        { id: 3, name: "Série", overview: "C", genre_ids: [18], popularity: 6 },
        { id: 5, name: "Série documental", overview: "D", genre_ids: [99], popularity: 2 },
      ],
    });
  };

  const results = await searchTmdb("  história  ");
  assert.deepEqual(results.map((result) => result.type), [
    "documentary",
    "series",
    "movie",
    "documentary",
  ]);
});

test("mantém resultados parciais quando um endpoint de busca falha", async () => {
  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/search/movie")) return new Response(null, { status: 503 });
    return Response.json({
      results: [{ id: 4, name: "Série disponível", genre_ids: [], popularity: 1 }],
    });
  };

  assert.equal((await searchTmdb("série")).length, 1);
});

test("carrega detalhes e prioriza trailer oficial do YouTube", async () => {
  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/videos")) {
      return Response.json({
        results: [
          { key: "aaaaaaaaaaa", site: "YouTube", type: "Trailer", official: false },
          { key: "bbbbbbbbbbb", site: "YouTube", type: "Trailer", official: true },
        ],
      });
    }
    return Response.json({
      id: 10,
      title: "Documentário",
      overview: "Descrição",
      poster_path: "/poster.jpg",
      release_date: "2024-02-01",
      genres: [{ id: 99, name: "Documentário" }],
    });
  };

  const details = await getTmdbDetails("movie", 10);
  assert.equal(details.type, "documentary");
  assert.equal(details.year, "2024");
  assert.equal(details.thumbnailUrl, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(details.trailerUrl, "https://www.youtube.com/watch?v=bbbbbbbbbbb");
});

test("rejeita configuração ausente, busca inválida e falha total", async () => {
  delete process.env.TMDB_API_KEY;
  assert.equal((await searchTmdb("a")).length, 0);
  await assert.rejects(() => getTmdbDetails("movie", 0), /Invalid TMDB id/);

  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(null, { status: 500 });
  await assert.rejects(() => searchTmdb("indisponível"), /unavailable/);
});
