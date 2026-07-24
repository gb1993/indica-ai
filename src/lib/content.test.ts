import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeYouTubeVideoId,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "./content.ts";

const videoId = "dQw4w9WgXcQ";

test("normaliza formatos HTTPS permitidos do YouTube", () => {
  assert.equal(
    normalizeYouTubeVideoId(`https://www.youtube.com/watch?v=${videoId}`),
    videoId,
  );
  assert.equal(normalizeYouTubeVideoId(`https://youtu.be/${videoId}`), videoId);
  assert.equal(
    normalizeYouTubeVideoId(`https://m.youtube.com/shorts/${videoId}`),
    videoId,
  );
  assert.equal(
    normalizeYouTubeVideoId(`https://www.youtube.com/embed/${videoId}`),
    videoId,
  );
  assert.equal(
    normalizeYouTubeVideoId(`https://youtube.com/live/${videoId}`),
    videoId,
  );
  assert.equal(
    normalizeYouTubeVideoId(`  https://youtube.com/watch?v=${videoId}  `),
    videoId,
  );
});

test("rejeita protocolos, hosts, credenciais e IDs inválidos", () => {
  assert.equal(
    normalizeYouTubeVideoId(`http://www.youtube.com/watch?v=${videoId}`),
    null,
  );
  assert.equal(
    normalizeYouTubeVideoId(`https://youtube.com.evil.test/watch?v=${videoId}`),
    null,
  );
  assert.equal(
    normalizeYouTubeVideoId(`https://user:secret@youtube.com/watch?v=${videoId}`),
    null,
  );
  assert.equal(
    normalizeYouTubeVideoId("https://youtube.com/watch?v=curto"),
    null,
  );
  assert.equal(normalizeYouTubeVideoId("não é uma URL"), null);
  assert.equal(normalizeYouTubeVideoId(`https://example.com/watch?v=${videoId}`), null);
  assert.equal(normalizeYouTubeVideoId("https://youtube.com/channel/teste"), null);
  assert.equal(normalizeYouTubeVideoId("https://youtu.be/"), null);
});

test("gera apenas URLs conhecidas a partir do ID já normalizado", () => {
  assert.equal(
    youtubeWatchUrl(videoId),
    `https://www.youtube.com/watch?v=${videoId}`,
  );
  assert.equal(
    youtubeEmbedUrl(videoId),
    `https://www.youtube-nocookie.com/embed/${videoId}`,
  );
});
