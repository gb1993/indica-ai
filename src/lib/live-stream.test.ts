import assert from "node:assert/strict";
import test from "node:test";

import {
  AdaptiveFrameRateController,
  attemptVideoPlayback,
  calculatePacketLossRate,
  closePeerConnection,
  hasDisplayAudio,
  LIVE_QUALITY_COOLDOWN_MS,
  stopMediaStream,
} from "./live-stream.ts";

test("calcula perda usando deltas da janela recente", () => {
  assert.equal(calculatePacketLossRate(undefined, { sent: 100, lost: 5 }), null);
  assert.equal(
    calculatePacketLossRate(
      { sent: 100, lost: 5 },
      { sent: 190, lost: 15 },
    ),
    0.1,
  );
  assert.equal(
    calculatePacketLossRate(
      { sent: 100, lost: 5 },
      { sent: 100, lost: 5 },
    ),
    0,
  );
});

test("reduz para 30 fps somente após três amostras degradadas", () => {
  const controller = new AdaptiveFrameRateController();
  assert.equal(controller.observe(0.05, 0), null);
  assert.equal(controller.observe(0.08, 3_000), null);
  assert.equal(controller.observe(0.06, 6_000), 30);
  assert.equal(controller.currentFrameRate, 30);
});

test("retorna para 60 fps após estabilidade e cooldown", () => {
  const controller = new AdaptiveFrameRateController();
  controller.observe(0.05, 0);
  controller.observe(0.05, 3_000);
  controller.observe(0.05, 6_000);
  for (let index = 0; index < 9; index += 1) {
    assert.equal(controller.observe(0.01, 9_000 + index * 3_000), null);
  }
  assert.equal(
    controller.observe(0.01, 6_000 + LIVE_QUALITY_COOLDOWN_MS + 3_000),
    60,
  );
});

test("uma amostra neutra interrompe a sequência de degradação", () => {
  const controller = new AdaptiveFrameRateController();
  controller.observe(0.08, 0);
  controller.observe(0.01, 3_000);
  controller.observe(0.08, 6_000);
  controller.observe(0.08, 9_000);
  assert.equal(controller.observe(0.08, 12_000), 30);
});

test("trata autoplay bloqueado sem propagar erro", async () => {
  assert.equal(await attemptVideoPlayback({ play: async () => undefined }), true);
  assert.equal(
    await attemptVideoPlayback({ play: async () => Promise.reject(new Error("blocked")) }),
    false,
  );
});

test("continua sem áudio quando o navegador retorna somente vídeo", () => {
  assert.equal(hasDisplayAudio({ getAudioTracks: () => [] }), false);
  assert.equal(
    hasDisplayAudio({ getAudioTracks: () => [{} as MediaStreamTrack] }),
    true,
  );
});

test("cleanup encerra tracks e peer connection", () => {
  let stopped = 0;
  let closed = 0;
  stopMediaStream({
    getTracks: () => [
      { stop: () => { stopped += 1; } },
      { stop: () => { stopped += 1; } },
    ] as MediaStreamTrack[],
  });
  closePeerConnection({ close: () => { closed += 1; } });
  assert.equal(stopped, 2);
  assert.equal(closed, 1);
});
