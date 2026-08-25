import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCloudflareBillingSnapshot } from "@/lib/cloudflare-billing";
import {
  calculateLiveStreamUsageStatus,
  type LiveStreamUsageStatus,
} from "@/lib/live-stream-usage";

export async function getLiveStreamUsageStatus(
  supabase: SupabaseClient,
): Promise<LiveStreamUsageStatus> {
  const snapshot = await getCloudflareBillingSnapshot();
  const since = snapshot?.confirmedThrough
    ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const { data, error } = await supabase.rpc("get_live_stream_observed_usage", {
    p_since: since,
  });
  if (error) return calculateLiveStreamUsageStatus(null, 0);
  return calculateLiveStreamUsageStatus(snapshot, Number(data ?? 0));
}
