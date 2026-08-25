import "server-only";

import { z } from "zod";

const configSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
});

const sessionDescriptionSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1).max(500_000),
});

const trackSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  trackName: z.string().min(1).max(200),
  mid: z.string().max(50).optional(),
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
});

const newSessionResponseSchema = z.object({
  sessionId: z.string().min(1).max(200),
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
});

const tracksResponseSchema = z.object({
  sessionDescription: sessionDescriptionSchema,
  tracks: z.array(trackSchema).min(1).max(8),
  requiresImmediateRenegotiation: z.boolean().optional(),
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
});

export type SfuSessionDescription = z.infer<typeof sessionDescriptionSchema>;
export type SfuTrackLocator = {
  location: "remote";
  sessionId: string;
  trackName: string;
};

function getConfig() {
  return configSchema.parse({
    appId: process.env.CLOUDFLARE_REALTIME_APP_ID,
    appSecret: process.env.CLOUDFLARE_REALTIME_APP_SECRET,
  });
}

async function requestCloudflare<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit,
) {
  const config = getConfig();
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(config.appId)}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.appSecret}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Cloudflare Realtime request failed with status ${response.status}`);
  }
  return schema.parse(body);
}

export async function createSfuSession(correlationId: string) {
  const query = new URLSearchParams({ correlationId });
  return requestCloudflare(
    `/sessions/new?${query.toString()}`,
    newSessionResponseSchema,
    { method: "POST" },
  );
}

export async function publishSfuTracks(
  sessionId: string,
  sessionDescription: SfuSessionDescription,
) {
  const response = await requestCloudflare(
    `/sessions/${encodeURIComponent(sessionId)}/tracks/new`,
    tracksResponseSchema,
    {
      method: "POST",
      body: JSON.stringify({ sessionDescription, autoDiscover: true }),
    },
  );
  const tracks: SfuTrackLocator[] = response.tracks.map((track) => ({
    location: "remote",
    sessionId,
    trackName: track.trackName,
  }));
  return { sessionDescription: response.sessionDescription, tracks };
}

export async function subscribeSfuTracks(
  sessionId: string,
  tracks: SfuTrackLocator[],
) {
  return requestCloudflare(
    `/sessions/${encodeURIComponent(sessionId)}/tracks/new`,
    tracksResponseSchema,
    { method: "POST", body: JSON.stringify({ tracks }) },
  );
}

export async function renegotiateSfuSession(
  sessionId: string,
  sessionDescription: SfuSessionDescription,
) {
  const response = await fetchCloudflareWithoutRequiredTracks(
    `/sessions/${encodeURIComponent(sessionId)}/renegotiate`,
    { method: "PUT", body: JSON.stringify({ sessionDescription }) },
  );
  return response;
}

async function fetchCloudflareWithoutRequiredTracks(
  path: string,
  init: RequestInit,
) {
  const config = getConfig();
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(config.appId)}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.appSecret}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Cloudflare Realtime renegotiation failed with status ${response.status}`);
  }
}

export function parseSfuSessionDescription(value: unknown) {
  return sessionDescriptionSchema.safeParse(value);
}
