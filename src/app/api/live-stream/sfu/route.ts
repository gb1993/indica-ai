import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createSfuSession,
  parseSfuSessionDescription,
  publishSfuTracks,
  renegotiateSfuSession,
  subscribeSfuTracks,
  type SfuTrackLocator,
} from "@/lib/cloudflare-realtime";
import {
  createSfuConnectionToken,
  verifySfuConnectionToken,
} from "@/lib/sfu-connection-token";
import { getLiveStreamUsageStatus } from "@/lib/live-stream-capacity";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("publish"),
    liveSessionId: z.uuid(),
    sessionDescription: z.unknown(),
  }),
  z.object({
    operation: z.literal("subscribe"),
    liveSessionId: z.uuid(),
  }),
  z.object({
    operation: z.literal("renegotiate"),
    liveSessionId: z.uuid(),
    sfuSessionId: z.string().min(1).max(200),
    connectionToken: z.string().min(1).max(2_000),
    sessionDescription: z.unknown(),
  }),
]);

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === request.nextUrl.origin
    && (!fetchSite || fetchSite === "same-origin");
}

function privateResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return privateResponse({ error: "Origem não autorizada." }, 403);
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return privateResponse({ error: "Requisição inválida." }, 400);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return privateResponse({ error: "Sessão inválida." }, 401);

  const { data: liveSession } = await supabase
    .from("live_stream_sessions")
    .select("id, host_user_id, status, sfu_session_id, sfu_tracks")
    .eq("id", parsed.data.liveSessionId)
    .maybeSingle();
  if (!liveSession) {
    return privateResponse({ error: "Transmissão indisponível." }, 404);
  }

  try {
    if (parsed.data.operation === "publish") {
      if (liveSession.host_user_id !== user.id || liveSession.status !== "starting") {
        return privateResponse({ error: "Somente o host pode publicar a transmissão." }, 403);
      }
      const description = parseSfuSessionDescription(parsed.data.sessionDescription);
      if (!description.success || description.data.type !== "offer") {
        return privateResponse({ error: "Oferta WebRTC inválida." }, 400);
      }
      const usage = await getLiveStreamUsageStatus(supabase);
      if (!usage.canStart) {
        return privateResponse({
          error: usage.monitoringAvailable
            ? "As transmissões atingiram o limite preventivo de consumo."
            : "O consumo da transmissão não pôde ser verificado.",
        }, 503);
      }

      const sfuSession = await createSfuSession(
        `${liveSession.id}:host:${user.id}`,
      );
      const published = await publishSfuTracks(
        sfuSession.sessionId,
        description.data,
      );
      const { error } = await supabase.rpc("activate_live_stream_sfu", {
        p_session_id: liveSession.id,
        p_sfu_session_id: sfuSession.sessionId,
        p_sfu_tracks: published.tracks,
      });
      if (error) throw new Error("Could not activate SFU live stream");

      return privateResponse({
        sessionDescription: published.sessionDescription,
      });
    }

    if (parsed.data.operation === "subscribe") {
      const usage = await getLiveStreamUsageStatus(supabase);
      if (!usage.canSubscribe) {
        return privateResponse({
          error: usage.monitoringAvailable
            ? "Novos espectadores foram bloqueados pelo limite preventivo de consumo."
            : "O consumo da transmissão não pôde ser verificado.",
        }, 503);
      }
      const tracks = liveSession.sfu_tracks as SfuTrackLocator[] | null;
      if (
        liveSession.status !== "live"
        || !liveSession.sfu_session_id
        || !Array.isArray(tracks)
        || !tracks.length
      ) {
        return privateResponse({ error: "A mídia ainda não está disponível." }, 409);
      }

      const sfuSession = await createSfuSession(
        `${liveSession.id}:viewer:${user.id}`,
      );
      const subscribed = await subscribeSfuTracks(sfuSession.sessionId, tracks);
      const secret = process.env.CLOUDFLARE_REALTIME_APP_SECRET;
      if (!secret) throw new Error("Cloudflare Realtime is not configured");
      const connectionToken = createSfuConnectionToken({
        liveSessionId: liveSession.id,
        sfuSessionId: sfuSession.sessionId,
        userId: user.id,
      }, secret);

      return privateResponse({
        sfuSessionId: sfuSession.sessionId,
        connectionToken,
        sessionDescription: subscribed.sessionDescription,
      });
    }

    const description = parseSfuSessionDescription(parsed.data.sessionDescription);
    const secret = process.env.CLOUDFLARE_REALTIME_APP_SECRET;
    if (
      !secret
      || !description.success
      || description.data.type !== "answer"
      || !verifySfuConnectionToken(
        parsed.data.connectionToken,
        {
          liveSessionId: liveSession.id,
          sfuSessionId: parsed.data.sfuSessionId,
          userId: user.id,
        },
        secret,
      )
    ) {
      return privateResponse({ error: "Renegociação inválida." }, 403);
    }

    await renegotiateSfuSession(
      parsed.data.sfuSessionId,
      description.data,
    );
    return privateResponse({ ok: true });
  } catch {
    return privateResponse(
      { error: "Não foi possível conectar ao serviço de transmissão." },
      502,
    );
  }
}
