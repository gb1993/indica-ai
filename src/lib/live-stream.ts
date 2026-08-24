import { z } from "zod";

export const MAX_LIVE_VIEWERS = 9;
export const LIVE_HEARTBEAT_INTERVAL_MS = 20_000;
export const LIVE_STALE_AFTER_MS = 90_000;
export const LIVE_STATS_INTERVAL_MS = 3_000;
export const LIVE_QUALITY_COOLDOWN_MS = 30_000;

export type LiveStreamSession = {
  id: string;
  groupId: string;
  hostUserId: string;
  hostName: string;
  startedAt: string | null;
};

const uuid = z.uuid();
const clientId = z.string().min(1).max(100);
const signalBase = {
  sessionId: uuid,
  senderUserId: uuid,
  senderClientId: clientId,
  targetUserId: uuid.optional(),
  targetClientId: clientId.optional(),
};

const sessionDescription = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1).max(200_000),
});

const iceCandidate = z.object({
  candidate: z.string().max(10_000),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const liveSignalSchema = z.discriminatedUnion("event", [
  z.object({ ...signalBase, event: z.literal("viewer-ready") }),
  z.object({
    ...signalBase,
    event: z.literal("webrtc-offer"),
    description: sessionDescription.extend({ type: z.literal("offer") }),
  }),
  z.object({
    ...signalBase,
    event: z.literal("webrtc-answer"),
    description: sessionDescription.extend({ type: z.literal("answer") }),
  }),
  z.object({
    ...signalBase,
    event: z.literal("ice-candidate"),
    candidate: iceCandidate,
  }),
  z.object({
    ...signalBase,
    event: z.literal("viewer-rejected"),
    reason: z.enum(["room-full", "duplicate-viewer"]),
  }),
  z.object({ ...signalBase, event: z.literal("stream-ended") }),
]);

export type LiveSignal = z.infer<typeof liveSignalSchema>;
export type LiveSignalEvent = LiveSignal["event"];

export function parseLiveSignal(
  event: string,
  payload: unknown,
): LiveSignal | null {
  const parsed = liveSignalSchema.safeParse(payload);
  if (!parsed.success || parsed.data.event !== event) return null;
  return parsed.data;
}

export function signalTopic(sessionId: string, senderUserId: string) {
  return `live:${sessionId}:signal:${senderUserId}`;
}

export function canAcceptViewer(
  connectedViewerIds: ReadonlySet<string>,
  viewerUserId: string,
) {
  return (
    connectedViewerIds.has(viewerUserId) ||
    connectedViewerIds.size < MAX_LIVE_VIEWERS
  );
}

export type PacketCounters = { sent: number; lost: number };

export function calculatePacketLossRate(
  previous: PacketCounters | undefined,
  current: PacketCounters,
) {
  if (!previous) return null;
  const sent = Math.max(0, current.sent - previous.sent);
  const lost = Math.max(0, current.lost - previous.lost);
  const total = sent + lost;
  return total > 0 ? lost / total : 0;
}

export class AdaptiveFrameRateController {
  private badSamples = 0;
  private goodSamples = 0;
  private cooldownUntil = 0;
  public currentFrameRate: 30 | 60;

  constructor(currentFrameRate: 30 | 60 = 60) {
    this.currentFrameRate = currentFrameRate;
  }

  observe(lossRate: number, now = Date.now()): 30 | 60 | null {
    if (this.currentFrameRate === 60) {
      this.goodSamples = 0;
      this.badSamples = lossRate >= 0.05 ? this.badSamples + 1 : 0;
      if (this.badSamples < 3) return null;

      this.badSamples = 0;
      this.currentFrameRate = 30;
      this.cooldownUntil = now + LIVE_QUALITY_COOLDOWN_MS;
      return 30;
    }

    this.badSamples = 0;
    this.goodSamples = lossRate < 0.02 ? this.goodSamples + 1 : 0;
    if (this.goodSamples < 10 || now < this.cooldownUntil) return null;

    this.goodSamples = 0;
    this.currentFrameRate = 60;
    return 60;
  }
}

export async function attemptVideoPlayback(video: Pick<HTMLVideoElement, "play">) {
  try {
    await video.play();
    return true;
  } catch {
    return false;
  }
}

export function hasDisplayAudio(
  stream: Pick<MediaStream, "getAudioTracks">,
) {
  return stream.getAudioTracks().length > 0;
}

export async function addOrQueueIceCandidate(
  connection: Pick<RTCPeerConnection, "remoteDescription" | "addIceCandidate">,
  pendingCandidates: RTCIceCandidateInit[],
  candidate: RTCIceCandidateInit,
) {
  if (connection.remoteDescription) {
    await connection.addIceCandidate(candidate);
  } else {
    pendingCandidates.push(candidate);
  }
}

export async function flushIceCandidates(
  connection: Pick<RTCPeerConnection, "addIceCandidate">,
  pendingCandidates: RTCIceCandidateInit[],
) {
  for (const candidate of pendingCandidates.splice(0)) {
    await connection.addIceCandidate(candidate);
  }
}

export function stopMediaStream(
  stream: Pick<MediaStream, "getTracks"> | null | undefined,
) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function closePeerConnection(
  peer: Pick<RTCPeerConnection, "close"> | null | undefined,
) {
  peer?.close();
}
