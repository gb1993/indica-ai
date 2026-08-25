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

export type PacketCounters = { sent: number; lost: number };
export type LiveStreamConnectedParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
  isCurrentUser: boolean;
  joinedAt: string;
};

export function buildLiveStreamParticipants({
  presences,
  profiles,
  hostUserId,
  hostName,
  currentUserId,
}: {
  presences: Array<{ id: string; joinedAt: string }>;
  profiles: Array<{ id: string; name: string; avatar_url: string | null }>;
  hostUserId: string;
  hostName: string;
  currentUserId: string;
}): LiveStreamConnectedParticipant[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return presences
    .map((presence) => {
      const profile = profilesById.get(presence.id);
      return {
        id: presence.id,
        name: profile?.name ?? (presence.id === hostUserId ? hostName : "Membro"),
        avatarUrl: profile?.avatar_url ?? null,
        isHost: presence.id === hostUserId,
        isCurrentUser: presence.id === currentUserId,
        joinedAt: presence.joinedAt,
      };
    })
    .sort((left, right) => Number(right.isHost) - Number(left.isHost)
      || left.joinedAt.localeCompare(right.joinedAt)
      || left.name.localeCompare(right.name));
}

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
