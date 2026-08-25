import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLiveStreamUsageStatus,
  LIVE_STREAM_BLOCK_BYTES,
  LIVE_STREAM_HARD_STOP_BYTES,
  parseCloudflareBillingUsage,
} from "./live-stream-usage.ts";

test("soma somente métricas Realtime e normaliza unidades", () => {
  const snapshot = parseCloudflareBillingUsage({
    success: true,
    result: [
      {
        ChargeDescription: "Realtime SFU egress",
        ConsumedQuantity: 12.5,
        ConsumedUnit: "GB",
        ChargePeriodEnd: "2026-08-20T00:00:00Z",
      },
      {
        x_BillableMetricName: "Calls TURN transfer",
        ConsumedQuantity: 500,
        ConsumedUnit: "MB",
        ChargePeriodEnd: "2026-08-21T00:00:00Z",
      },
      {
        x_ProductFamilyName: "Workers",
        ConsumedQuantity: 999,
        ConsumedUnit: "GB",
        ChargePeriodEnd: "2026-08-22T00:00:00Z",
      },
    ],
  }, new Date("2026-08-24T12:00:00Z"));
  assert.equal(snapshot.confirmedBytes, 13_000_000_000);
  assert.equal(snapshot.confirmedThrough, "2026-08-21T00:00:00.000Z");
});

test("usa o início do mês quando ainda não há consumo Realtime", () => {
  const snapshot = parseCloudflareBillingUsage(
    { success: true, result: [] },
    new Date("2026-08-24T12:00:00Z"),
  );
  assert.equal(snapshot.confirmedBytes, 0);
  assert.equal(snapshot.confirmedThrough, "2026-08-01T00:00:00.000Z");
});

test("bloqueia novas conexões e encerra no limite rígido", () => {
  const base = {
    confirmedBytes: 0,
    confirmedThrough: "2026-08-01T00:00:00.000Z",
    checkedAt: "2026-08-24T12:00:00.000Z",
  };
  const blocked = calculateLiveStreamUsageStatus(
    base,
    LIVE_STREAM_BLOCK_BYTES / 1.25,
  );
  assert.equal(blocked.level, "blocked");
  assert.equal(blocked.canStart, false);
  assert.equal(blocked.mustEndActiveStreams, false);

  const hardStop = calculateLiveStreamUsageStatus(
    base,
    LIVE_STREAM_HARD_STOP_BYTES / 1.25,
  );
  assert.equal(hardStop.level, "hard-stop");
  assert.equal(hardStop.mustEndActiveStreams, true);
});

test("falha fechada quando o billing não pode ser consultado", () => {
  const status = calculateLiveStreamUsageStatus(null, 10_000);
  assert.equal(status.level, "monitoring-unavailable");
  assert.equal(status.canStart, false);
  assert.equal(status.canSubscribe, false);
});
