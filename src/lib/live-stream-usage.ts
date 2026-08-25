export const LIVE_STREAM_FREE_BYTES = 1_000_000_000_000;
export const LIVE_STREAM_WARNING_BYTES = 800_000_000_000;
export const LIVE_STREAM_BLOCK_BYTES = 850_000_000_000;
export const LIVE_STREAM_HARD_STOP_BYTES = 900_000_000_000;
export const LIVE_STREAM_LOCAL_SAFETY_FACTOR = 1.25;
export const LIVE_USAGE_REPORT_INTERVAL_MS = 20_000;

export type CloudflareBillingSnapshot = {
  confirmedBytes: number;
  confirmedThrough: string;
  checkedAt: string;
};

export type LiveStreamUsageStatus = {
  canStart: boolean;
  canSubscribe: boolean;
  mustEndActiveStreams: boolean;
  monitoringAvailable: boolean;
  effectiveBytes: number;
  level: "available" | "warning" | "blocked" | "hard-stop" | "monitoring-unavailable";
};

function recordValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
}

function quantityInBytes(quantity: number, unitValue: unknown) {
  const unit = String(unitValue ?? "").trim().toLowerCase();
  if (["b", "byte", "bytes"].includes(unit)) return quantity;
  if (["kb", "kilobyte", "kilobytes"].includes(unit)) return quantity * 1_000;
  if (["mb", "megabyte", "megabytes"].includes(unit)) return quantity * 1_000_000;
  if (["gb", "gigabyte", "gigabytes"].includes(unit)) return quantity * 1_000_000_000;
  if (["tb", "terabyte", "terabytes"].includes(unit)) return quantity * 1_000_000_000_000;
  if (["kib", "kibibyte", "kibibytes"].includes(unit)) return quantity * 1_024;
  if (["mib", "mebibyte", "mebibytes"].includes(unit)) return quantity * 1_024 ** 2;
  if (["gib", "gibibyte", "gibibytes"].includes(unit)) return quantity * 1_024 ** 3;
  return null;
}

function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function parseCloudflareBillingUsage(
  body: unknown,
  now = new Date(),
): CloudflareBillingSnapshot {
  if (!body || typeof body !== "object") throw new Error("Invalid Cloudflare billing response");
  const response = body as { success?: unknown; result?: unknown };
  if (response.success !== true || !Array.isArray(response.result)) {
    throw new Error("Cloudflare billing request was not successful");
  }

  let confirmedBytes = 0;
  let confirmedThrough = startOfUtcMonth(now);
  for (const value of response.result) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const identity = [
      recordValue(record, "ChargeDescription", "charge_description"),
      recordValue(record, "x_BillableMetricName", "x_billable_metric_name"),
      recordValue(record, "x_ProductFamilyName", "x_product_family_name", "service_family_name"),
      recordValue(record, "ServiceProviderName", "service_provider_name", "service_name"),
    ].map(String).join(" ");
    if (!/realtime|calls|sfu|turn/i.test(identity)) continue;

    const quantity = Number(recordValue(record, "ConsumedQuantity", "consumed_quantity"));
    const bytes = quantityInBytes(
      quantity,
      recordValue(record, "ConsumedUnit", "consumed_unit"),
    );
    if (bytes === null || !Number.isFinite(bytes) || bytes < 0) continue;
    confirmedBytes += bytes;

    const periodEnd = String(recordValue(record, "ChargePeriodEnd", "charge_period_end") ?? "");
    const parsedEnd = Date.parse(periodEnd);
    if (Number.isFinite(parsedEnd) && parsedEnd > Date.parse(confirmedThrough)) {
      confirmedThrough = new Date(parsedEnd).toISOString();
    }
  }

  return {
    confirmedBytes: Math.round(confirmedBytes),
    confirmedThrough,
    checkedAt: now.toISOString(),
  };
}

export function calculateLiveStreamUsageStatus(
  snapshot: CloudflareBillingSnapshot | null,
  locallyObservedBytes: number,
): LiveStreamUsageStatus {
  const safeLocalBytes = Math.max(0, locallyObservedBytes) * LIVE_STREAM_LOCAL_SAFETY_FACTOR;
  const effectiveBytes = Math.round((snapshot?.confirmedBytes ?? 0) + safeLocalBytes);
  if (!snapshot) {
    return {
      canStart: false,
      canSubscribe: false,
      mustEndActiveStreams: effectiveBytes >= LIVE_STREAM_HARD_STOP_BYTES,
      monitoringAvailable: false,
      effectiveBytes,
      level: "monitoring-unavailable",
    };
  }
  if (effectiveBytes >= LIVE_STREAM_HARD_STOP_BYTES) {
    return {
      canStart: false,
      canSubscribe: false,
      mustEndActiveStreams: true,
      monitoringAvailable: true,
      effectiveBytes,
      level: "hard-stop",
    };
  }
  if (effectiveBytes >= LIVE_STREAM_BLOCK_BYTES) {
    return {
      canStart: false,
      canSubscribe: false,
      mustEndActiveStreams: false,
      monitoringAvailable: true,
      effectiveBytes,
      level: "blocked",
    };
  }
  return {
    canStart: true,
    canSubscribe: true,
    mustEndActiveStreams: false,
    monitoringAvailable: true,
    effectiveBytes,
    level: effectiveBytes >= LIVE_STREAM_WARNING_BYTES ? "warning" : "available",
  };
}
