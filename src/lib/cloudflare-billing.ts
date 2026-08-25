import "server-only";

import { z } from "zod";

import {
  parseCloudflareBillingUsage,
  type CloudflareBillingSnapshot,
} from "@/lib/live-stream-usage";

const configSchema = z.object({
  accountId: z.string().regex(/^[a-f0-9]{32}$/i),
  apiToken: z.string().min(20),
});

const SUCCESS_CACHE_MS = 5 * 60_000;
const FAILURE_CACHE_MS = 30_000;
let cachedSnapshot: {
  expiresAt: number;
  value: CloudflareBillingSnapshot | null;
} | null = null;
let pendingSnapshot: Promise<CloudflareBillingSnapshot | null> | null = null;

function getConfig() {
  return configSchema.safeParse({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_BILLING_API_TOKEN,
  });
}

async function requestBillingSnapshot() {
  const config = getConfig();
  if (!config.success) return null;
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.data.accountId)}/billable/usage`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${config.data.apiToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return null;
    return parseCloudflareBillingUsage(await response.json());
  } catch {
    return null;
  }
}

export async function getCloudflareBillingSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) return cachedSnapshot.value;
  if (pendingSnapshot) return pendingSnapshot;
  pendingSnapshot = requestBillingSnapshot().then((value) => {
    cachedSnapshot = {
      value,
      expiresAt: Date.now() + (value ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS),
    };
    pendingSnapshot = null;
    return value;
  });
  return pendingSnapshot;
}
