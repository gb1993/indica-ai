"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  activateLiveStreamAction,
  endLiveStreamAction,
  getActiveLiveStreamAction,
  heartbeatLiveStreamAction,
  startLiveStreamAction,
} from "@/app/app/groups/live-actions";
import {
  AdaptiveFrameRateController,
  addOrQueueIceCandidate,
  attemptVideoPlayback,
  calculatePacketLossRate,
  canAcceptViewer,
  closePeerConnection,
  flushIceCandidates,
  hasDisplayAudio as streamHasDisplayAudio,
  LIVE_HEARTBEAT_INTERVAL_MS,
  LIVE_STATS_INTERVAL_MS,
  type LiveSignal,
  type LiveSignalEvent,
  type LiveStreamSession,
  parseLiveSignal,
  signalTopic,
  stopMediaStream,
  type PacketCounters,
} from "@/lib/live-stream";
import { createClient } from "@/lib/supabase/browser";
import { getPublicEnv } from "@/lib/env";

type ViewState =
  | "idle"
  | "starting"
  | "hosting"
  | "connecting"
  | "watching"
  | "room-full"
  | "connection-failed"
  | "ended";

type HostPeer = {
  clientId: string;
  connection: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
};

type RealtimeToken = {
  accessToken: string;
  expiresAt?: number;
  userId: string;
};

function subscribe(channel: RealtimeChannel) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Realtime subscription timed out")),
      10_000,
    );

    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timeout);
        resolve();
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        window.clearTimeout(timeout);
        reject(error ?? new Error(`Realtime subscription failed: ${status}`));
      }
    });
  });
}

function onSignals(
  channel: RealtimeChannel,
  events: LiveSignalEvent[],
  callback: (signal: LiveSignal) => void,
) {
  events.forEach((event) => {
    channel.on("broadcast", { event }, ({ payload }) => {
      const signal = parseLiveSignal(event, payload);
      if (signal) callback(signal);
    });
  });
  return channel;
}

async function sendSignal(channel: RealtimeChannel, signal: LiveSignal) {
  const result = await channel.send({
    type: "broadcast",
    event: signal.event,
    payload: signal,
  });
  if (result !== "ok") throw new Error("Realtime signal was not delivered");
}

export function LiveStreamPanel({
  groupId,
  userId,
  initialSession,
}: {
  groupId: string;
  userId: string;
  initialSession: LiveStreamSession | null;
}) {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [availableSession, setAvailableSession] =
    useState<LiveStreamSession | null>(initialSession);
  const [errorMessage, setErrorMessage] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [hasDisplayAudio, setHasDisplayAudio] = useState(false);
  const [frameRate, setFrameRate] = useState<30 | 60>(60);
  const [needsAudioActivation, setNeedsAudioActivation] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const refreshTokenTimerRef = useRef<number | null>(null);
  const baseChannelRef = useRef<RealtimeChannel | null>(null);
  const hostSignalChannelRef = useRef<RealtimeChannel | null>(null);
  const viewerOwnChannelRef = useRef<RealtimeChannel | null>(null);
  const viewerHostChannelRef = useRef<RealtimeChannel | null>(null);
  const viewerChannelsRef = useRef(new Map<string, RealtimeChannel>());
  const hostPeersRef = useRef(new Map<string, HostPeer>());
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const viewerPendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostSessionRef = useRef<LiveStreamSession | null>(null);
  const viewerSessionRef = useRef<LiveStreamSession | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const endingRef = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);
  const statsTimerRef = useRef<number | null>(null);
  const readyTimerRef = useRef<number | null>(null);
  const hostMissingTimerRef = useRef<number | null>(null);
  const packetCountersRef = useRef(new Map<string, PacketCounters>());
  const qualityControllerRef = useRef(new AdaptiveFrameRateController());
  const offerReceivedRef = useRef(false);

  const rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: getPublicEnv().NEXT_PUBLIC_WEBRTC_STUN_URL }],
  };

  function clearTimer(ref: React.MutableRefObject<number | null>) {
    if (ref.current !== null) window.clearInterval(ref.current);
    ref.current = null;
  }

  async function authenticateRealtime(client: SupabaseClient) {
    const response = await fetch("/api/realtime/token", {
      method: "POST",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Realtime authentication failed");

    const token = (await response.json()) as RealtimeToken;
    if (!token.accessToken || token.userId !== userId) {
      throw new Error("Realtime token does not match the current user");
    }

    await client.realtime.setAuth(token.accessToken);
    if (refreshTokenTimerRef.current !== null) {
      window.clearTimeout(refreshTokenTimerRef.current);
    }
    const expiresAt = (token.expiresAt ?? Math.floor(Date.now() / 1000) + 300) * 1000;
    const refreshIn = Math.max(30_000, expiresAt - Date.now() - 60_000);
    refreshTokenTimerRef.current = window.setTimeout(() => {
      void authenticateRealtime(client).catch(() => {
        setErrorMessage("A autenticação da transmissão expirou. Recarregue a página.");
      });
    }, refreshIn);
  }

  async function getRealtimeClient() {
    const client = clientRef.current ?? createClient();
    clientRef.current = client;
    await authenticateRealtime(client);
    return client;
  }

  function updatePresence(channel: RealtimeChannel) {
    const state = channel.presenceState();
    setParticipantCount(Math.max(1, Object.keys(state).length));
    return state;
  }

  function closeHostPeer(viewerUserId: string) {
    const peer = hostPeersRef.current.get(viewerUserId);
    closePeerConnection(peer?.connection);
    hostPeersRef.current.delete(viewerUserId);
    packetCountersRef.current.delete(viewerUserId);
  }

  function closeViewerPeer() {
    closePeerConnection(viewerPeerRef.current);
    viewerPeerRef.current = null;
    viewerPendingCandidatesRef.current = [];
    offerReceivedRef.current = false;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  function removeAllChannels() {
    const client = clientRef.current;
    if (!client) return;
    const channels = [
      baseChannelRef.current,
      hostSignalChannelRef.current,
      viewerOwnChannelRef.current,
      viewerHostChannelRef.current,
      ...viewerChannelsRef.current.values(),
    ];
    const uniqueChannels = new Set(channels.filter(Boolean) as RealtimeChannel[]);
    uniqueChannels.forEach((channel) => void client.removeChannel(channel));
    baseChannelRef.current = null;
    hostSignalChannelRef.current = null;
    viewerOwnChannelRef.current = null;
    viewerHostChannelRef.current = null;
    viewerChannelsRef.current.clear();
  }

  function cleanupResources(stopLocalTracks = true) {
    clearTimer(heartbeatTimerRef);
    clearTimer(statsTimerRef);
    clearTimer(readyTimerRef);
    clearTimer(hostMissingTimerRef);
    if (refreshTokenTimerRef.current !== null) {
      window.clearTimeout(refreshTokenTimerRef.current);
      refreshTokenTimerRef.current = null;
    }
    hostPeersRef.current.forEach(({ connection }) => connection.close());
    hostPeersRef.current.clear();
    packetCountersRef.current.clear();
    closeViewerPeer();
    removeAllChannels();
    if (stopLocalTracks) stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setParticipantCount(1);
  }

  async function endHosting() {
    const session = hostSessionRef.current;
    if (!session || endingRef.current) return;
    endingRef.current = true;

    const channel = hostSignalChannelRef.current;
    if (channel) {
      await sendSignal(channel, {
        event: "stream-ended",
        sessionId: session.id,
        senderUserId: userId,
        senderClientId: clientIdRef.current,
      }).catch(() => undefined);
    }

    const result = await endLiveStreamAction(session.id);
    cleanupResources(true);
    hostSessionRef.current = null;
    setAvailableSession(null);
    setViewState("ended");
    if (!result.ok) setErrorMessage(result.error);
    endingRef.current = false;
  }

  async function applyFrameRate(nextFrameRate: 30 | 60) {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        frameRate: { ideal: nextFrameRate, max: nextFrameRate },
      });
      setFrameRate(nextFrameRate);
    } catch {
      // Keep the stream alive at the browser-selected frame rate.
    }
  }

  async function sampleHostStats() {
    const lossRates: number[] = [];
    for (const [viewerUserId, peer] of hostPeersRef.current) {
      const reports = await peer.connection.getStats().catch(() => null);
      if (!reports) continue;
      let sent = 0;
      let lost = 0;
      reports.forEach((report) => {
        const kind = report.kind ?? report.mediaType;
        if (kind !== "video") return;
        if (report.type === "outbound-rtp") sent += report.packetsSent ?? 0;
        if (report.type === "remote-inbound-rtp") lost += report.packetsLost ?? 0;
      });
      const current = { sent, lost };
      const lossRate = calculatePacketLossRate(
        packetCountersRef.current.get(viewerUserId),
        current,
      );
      packetCountersRef.current.set(viewerUserId, current);
      if (lossRate !== null) lossRates.push(lossRate);
    }

    if (!lossRates.length) return;
    const nextFrameRate = qualityControllerRef.current.observe(
      Math.max(...lossRates),
    );
    if (nextFrameRate) await applyFrameRate(nextFrameRate);
  }

  async function handleHostSignal(viewerUserId: string, signal: LiveSignal) {
    const session = hostSessionRef.current;
    if (
      !session ||
      signal.sessionId !== session.id ||
      signal.senderUserId !== viewerUserId ||
      (signal.targetUserId && signal.targetUserId !== userId)
    ) return;

    if (signal.event === "viewer-ready") {
      const connectedIds = new Set(hostPeersRef.current.keys());
      if (!canAcceptViewer(connectedIds, viewerUserId)) {
        const hostChannel = hostSignalChannelRef.current;
        if (hostChannel) {
          await sendSignal(hostChannel, {
            event: "viewer-rejected",
            reason: "room-full",
            sessionId: session.id,
            senderUserId: userId,
            senderClientId: clientIdRef.current,
            targetUserId: viewerUserId,
            targetClientId: signal.senderClientId,
          }).catch(() => undefined);
        }
        return;
      }

      const current = hostPeersRef.current.get(viewerUserId);
      if (current?.clientId === signal.senderClientId) return;
      closeHostPeer(viewerUserId);

      const connection = new RTCPeerConnection(rtcConfig);
      const peer: HostPeer = {
        clientId: signal.senderClientId,
        connection,
        pendingCandidates: [],
      };
      hostPeersRef.current.set(viewerUserId, peer);
      localStreamRef.current?.getTracks().forEach((track) => {
        connection.addTrack(track, localStreamRef.current!);
      });

      connection.onicecandidate = ({ candidate }) => {
        const hostChannel = hostSignalChannelRef.current;
        if (!candidate || !hostChannel) return;
        void sendSignal(hostChannel, {
          event: "ice-candidate",
          sessionId: session.id,
          senderUserId: userId,
          senderClientId: clientIdRef.current,
          targetUserId: viewerUserId,
          targetClientId: peer.clientId,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment,
          },
        }).catch(() => undefined);
      };
      connection.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(connection.connectionState)) {
          closeHostPeer(viewerUserId);
        }
      };

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const hostChannel = hostSignalChannelRef.current;
      if (hostChannel) {
        await sendSignal(hostChannel, {
          event: "webrtc-offer",
          sessionId: session.id,
          senderUserId: userId,
          senderClientId: clientIdRef.current,
          targetUserId: viewerUserId,
          targetClientId: peer.clientId,
          description: { type: "offer", sdp: offer.sdp! },
        });
      }
      return;
    }

    const peer = hostPeersRef.current.get(viewerUserId);
    if (!peer || peer.clientId !== signal.senderClientId) return;

    if (signal.event === "webrtc-answer") {
      await peer.connection.setRemoteDescription(signal.description);
      await flushIceCandidates(peer.connection, peer.pendingCandidates);
    } else if (signal.event === "ice-candidate") {
      await addOrQueueIceCandidate(
        peer.connection,
        peer.pendingCandidates,
        signal.candidate,
      );
    }
  }

  async function ensureViewerSignalChannel(
    client: SupabaseClient,
    session: LiveStreamSession,
    viewerUserId: string,
  ) {
    if (viewerUserId === userId || viewerChannelsRef.current.has(viewerUserId)) return;
    const channel = client.channel(signalTopic(session.id, viewerUserId), {
      config: { private: true },
    });
    onSignals(channel, ["viewer-ready", "webrtc-answer", "ice-candidate"], (signal) => {
      void handleHostSignal(viewerUserId, signal).catch(() => {
        closeHostPeer(viewerUserId);
      });
    });
    viewerChannelsRef.current.set(viewerUserId, channel);
    await subscribe(channel).catch(() => {
      viewerChannelsRef.current.delete(viewerUserId);
      void client.removeChannel(channel);
    });
  }

  async function setupHost(session: LiveStreamSession) {
    const client = await getRealtimeClient();
    const hostSignalChannel = client.channel(signalTopic(session.id, userId), {
      config: { private: true },
    });
    const baseChannel = client.channel(`live:${session.id}`, {
      config: { private: true, presence: { key: userId } },
    });
    const syncPresence = () => {
      const presence = updatePresence(baseChannel);
      Object.keys(presence).forEach((presentUserId) => {
        void ensureViewerSignalChannel(client, session, presentUserId);
      });
      for (const viewerUserId of hostPeersRef.current.keys()) {
        if (!presence[viewerUserId]) closeHostPeer(viewerUserId);
      }
    };
    baseChannel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence);

    hostSignalChannelRef.current = hostSignalChannel;
    baseChannelRef.current = baseChannel;
    await Promise.all([subscribe(hostSignalChannel), subscribe(baseChannel)]);
    await baseChannel.track({
      user_id: userId,
      role: "host",
      joined_at: new Date().toISOString(),
    });

    const activation = await activateLiveStreamAction(session.id);
    if (!activation.ok) throw new Error(activation.error);
    setViewState("hosting");
    setAvailableSession(session);

    heartbeatTimerRef.current = window.setInterval(() => {
      void heartbeatLiveStreamAction(session.id).then((result) => {
        if (!result.ok) void endHosting();
      });
    }, LIVE_HEARTBEAT_INTERVAL_MS);
    statsTimerRef.current = window.setInterval(
      () => void sampleHostStats(),
      LIVE_STATS_INTERVAL_MS,
    );
  }

  async function startHosting() {
    setErrorMessage("");
    setViewState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });
    } catch (error) {
      setViewState("idle");
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) {
        setErrorMessage("Não foi possível acessar a tela selecionada.");
      }
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setHasDisplayAudio(streamHasDisplayAudio(stream));
    setFrameRate(60);
    qualityControllerRef.current = new AdaptiveFrameRateController();
    const videoTrack = stream.getVideoTracks()[0];
    videoTrack.addEventListener("ended", () => void endHosting(), { once: true });

    const result = await startLiveStreamAction(groupId);
    if (!result.ok) {
      stopMediaStream(stream);
      localStreamRef.current = null;
      setLocalStream(null);
      setViewState("idle");
      setErrorMessage(result.error);
      return;
    }

    hostSessionRef.current = result.data;
    endingRef.current = false;
    try {
      await setupHost(result.data);
    } catch {
      await endLiveStreamAction(result.data.id);
      cleanupResources(true);
      hostSessionRef.current = null;
      setViewState("connection-failed");
      setErrorMessage("Não foi possível conectar ao canal privado da transmissão.");
    }
  }

  async function handleViewerSignal(signal: LiveSignal) {
    const session = viewerSessionRef.current;
    if (
      !session ||
      signal.sessionId !== session.id ||
      signal.senderUserId !== session.hostUserId ||
      (signal.targetUserId && signal.targetUserId !== userId) ||
      (signal.targetClientId && signal.targetClientId !== clientIdRef.current)
    ) return;

    if (signal.event === "stream-ended") {
      cleanupResources(false);
      setAvailableSession(null);
      setViewState("ended");
      return;
    }
    if (signal.event === "viewer-rejected") {
      cleanupResources(false);
      setViewState(signal.reason === "room-full" ? "room-full" : "connection-failed");
      return;
    }
    if (signal.event === "webrtc-offer") {
      clearTimer(readyTimerRef);
      offerReceivedRef.current = true;
      closeViewerPeer();
      offerReceivedRef.current = true;
      const connection = new RTCPeerConnection(rtcConfig);
      viewerPeerRef.current = connection;
      connection.onicecandidate = ({ candidate }) => {
        const ownChannel = viewerOwnChannelRef.current;
        if (!candidate || !ownChannel) return;
        void sendSignal(ownChannel, {
          event: "ice-candidate",
          sessionId: session.id,
          senderUserId: userId,
          senderClientId: clientIdRef.current,
          targetUserId: session.hostUserId,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment,
          },
        }).catch(() => undefined);
      };
      connection.ontrack = async ({ streams }) => {
        const remoteStream = streams[0];
        if (!remoteStream || !remoteVideoRef.current) return;
        remoteVideoRef.current.srcObject = remoteStream;
        const played = await attemptVideoPlayback(remoteVideoRef.current);
        setNeedsAudioActivation(!played);
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") {
          setViewState("watching");
        } else if (connection.connectionState === "failed") {
          setViewState("connection-failed");
          setErrorMessage(
            "Não foi possível criar uma conexão direta com a transmissão. Tente novamente ou utilize outra rede.",
          );
          closeViewerPeer();
        }
      };

      await connection.setRemoteDescription(signal.description);
      await flushIceCandidates(
        connection,
        viewerPendingCandidatesRef.current,
      );
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      const ownChannel = viewerOwnChannelRef.current;
      if (ownChannel) {
        await sendSignal(ownChannel, {
          event: "webrtc-answer",
          sessionId: session.id,
          senderUserId: userId,
          senderClientId: clientIdRef.current,
          targetUserId: session.hostUserId,
          description: { type: "answer", sdp: answer.sdp! },
        });
      }
    } else if (signal.event === "ice-candidate") {
      const connection = viewerPeerRef.current;
      if (!connection) {
        viewerPendingCandidatesRef.current.push(signal.candidate);
      } else {
        await addOrQueueIceCandidate(
          connection,
          viewerPendingCandidatesRef.current,
          signal.candidate,
        );
      }
    }
  }

  async function setupViewer(session: LiveStreamSession) {
    cleanupResources(false);
    viewerSessionRef.current = session;
    clientIdRef.current = crypto.randomUUID();
    const client = await getRealtimeClient();
    const ownChannel = client.channel(signalTopic(session.id, userId), {
      config: { private: true },
    });
    const hostChannel = client.channel(signalTopic(session.id, session.hostUserId), {
      config: { private: true },
    });
    const baseChannel = client.channel(`live:${session.id}`, {
      config: { private: true, presence: { key: userId } },
    });
    onSignals(hostChannel, ["webrtc-offer", "ice-candidate", "viewer-rejected", "stream-ended"], (signal) => {
      void handleViewerSignal(signal).catch(() => {
        setViewState("connection-failed");
      });
    });

    let presenceSynced = false;
    const syncPresence = () => {
      const presence = updatePresence(baseChannel);
      if (!presenceSynced) presenceSynced = true;
      if (presence[session.hostUserId]) {
        clearTimer(hostMissingTimerRef);
      } else if (presenceSynced && hostMissingTimerRef.current === null) {
        hostMissingTimerRef.current = window.setTimeout(() => {
          cleanupResources(false);
          setAvailableSession(null);
          setViewState("ended");
        }, 5_000);
      }
    };
    baseChannel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence);

    viewerOwnChannelRef.current = ownChannel;
    viewerHostChannelRef.current = hostChannel;
    baseChannelRef.current = baseChannel;
    await Promise.all([
      subscribe(hostChannel),
      subscribe(ownChannel),
      subscribe(baseChannel),
    ]);
    await baseChannel.track({
      user_id: userId,
      role: "viewer",
      joined_at: new Date().toISOString(),
    });

    const announceReady = () => {
      if (offerReceivedRef.current) return;
      void sendSignal(ownChannel, {
        event: "viewer-ready",
        sessionId: session.id,
        senderUserId: userId,
        senderClientId: clientIdRef.current,
        targetUserId: session.hostUserId,
      }).catch(() => undefined);
    };
    announceReady();
    readyTimerRef.current = window.setInterval(announceReady, 2_000);
  }

  async function watchStream() {
    if (!availableSession) return;
    setErrorMessage("");
    setViewState("connecting");
    try {
      await setupViewer(availableSession);
    } catch {
      cleanupResources(false);
      setViewState("connection-failed");
      setErrorMessage("Não foi possível conectar ao canal privado da transmissão.");
    }
  }

  async function endPreviousHostSession() {
    if (!availableSession || availableSession.hostUserId !== userId) return;
    const result = await endLiveStreamAction(availableSession.id);
    if (result.ok) {
      setAvailableSession(null);
      setViewState("ended");
    } else {
      setErrorMessage(result.error);
    }
  }

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (["starting", "hosting"].includes(viewState)) return;
    let cancelled = false;
    const poll = async () => {
      const result = await getActiveLiveStreamAction(groupId);
      if (cancelled || !result.ok) return;
      setAvailableSession(result.data);
      if (
        ["connecting", "watching"].includes(viewState) &&
        viewerSessionRef.current &&
        !result.data
      ) {
        cleanupResources(false);
        setViewState("ended");
      }
    };
    void poll();
    const interval = window.setInterval(poll, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // The cleanup routine intentionally reads the current refs instead of
    // becoming an effect dependency and restarting the polling interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, viewState]);

  useEffect(() => {
    const handlePageHide = () => {
      const session = hostSessionRef.current;
      if (!session || endingRef.current) return;
      navigator.sendBeacon(
        "/api/live-stream/end",
        new Blob([JSON.stringify({ sessionId: session.id })], {
          type: "application/json",
        }),
      );
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      handlePageHide();
      window.removeEventListener("pagehide", handlePageHide);
      cleanupResources(true);
    };
    // This lifecycle handler must be registered once; all mutable resources
    // are read through refs during pagehide/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHost = availableSession?.hostUserId === userId;

  return (
    <section
      aria-labelledby="live-stream-title"
      className="mt-8 overflow-hidden rounded-2xl border bg-(--surface) shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            {(availableSession || ["starting", "hosting", "connecting", "watching"].includes(viewState)) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
                <span className="size-2 rounded-full bg-red-500" /> AO VIVO
              </span>
            )}
            <h2 id="live-stream-title" className="text-lg font-bold">
              Transmissão de tela
            </h2>
            <span className="new-feature-badge" aria-label="Novo recurso">
              NEW
            </span>
          </div>
          <p className="mt-1 text-sm text-(--muted)">
            Compartilhamento direto entre os membros do grupo.
          </p>
        </div>
        {(viewState === "hosting" || viewState === "watching") && (
          <span className="text-sm text-(--muted)">
            {participantCount} {participantCount === 1 ? "participante" : "participantes"}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {viewState === "hosting" ? (
          <div className="space-y-4">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-xl bg-black object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-(--muted)">
                <span className="rounded-full bg-(--surface-muted) px-3 py-1.5">
                  Qualidade: {frameRate} fps
                </span>
                <span className="rounded-full bg-(--surface-muted) px-3 py-1.5">
                  Áudio da tela: {hasDisplayAudio ? "disponível" : "indisponível"}
                </span>
              </div>
              <button type="button" onClick={() => void endHosting()} className="app-button-secondary text-red-500">
                Encerrar transmissão
              </button>
            </div>
          </div>
        ) : ["connecting", "watching"].includes(viewState) ? (
          <div className="space-y-4">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="aspect-video w-full rounded-xl bg-black object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-(--muted)">
                {viewState === "connecting"
                  ? "Conectando diretamente ao host…"
                  : `${availableSession?.hostName ?? "Um membro"} está compartilhando a tela.`}
              </p>
              {needsAudioActivation && (
                <button
                  type="button"
                  className="app-button-primary"
                  onClick={async () => {
                    if (!remoteVideoRef.current) return;
                    setNeedsAudioActivation(!(await attemptVideoPlayback(remoteVideoRef.current)));
                  }}
                >
                  Ativar áudio
                </button>
              )}
            </div>
          </div>
        ) : availableSession ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">
                {availableSession.hostName} está compartilhando a tela.
              </p>
              <p className="mt-1 text-sm text-(--muted)">
                A mídia será recebida diretamente por WebRTC.
              </p>
            </div>
            {isHost ? (
              <button type="button" onClick={() => void endPreviousHostSession()} className="app-button-secondary text-red-500">
                Encerrar minha transmissão
              </button>
            ) : (
              <button type="button" onClick={() => void watchStream()} className="app-button-primary">
                Assistir
              </button>
            )}
          </div>
        ) : viewState === "starting" ? (
          <p className="text-sm text-(--muted)">Preparando a transmissão…</p>
        ) : viewState === "room-full" ? (
          <div>
            <p className="font-semibold">A transmissão atingiu o limite de 9 espectadores.</p>
            <button type="button" onClick={() => setViewState("idle")} className="app-button-secondary mt-4">
              Voltar
            </button>
          </div>
        ) : viewState === "connection-failed" ? (
          <div>
            <p className="font-semibold">Não foi possível criar uma conexão direta com a transmissão.</p>
            <p className="mt-1 text-sm text-(--muted)">Tente novamente ou utilize outra rede.</p>
            <button type="button" onClick={() => setViewState("idle")} className="app-button-secondary mt-4">
              Voltar
            </button>
          </div>
        ) : viewState === "ended" ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm text-(--muted)">A transmissão foi encerrada.</p>
            <button type="button" onClick={() => setViewState("idle")} className="app-button-secondary">
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Nenhuma transmissão ativa.</p>
              <p className="mt-1 text-sm text-(--muted)">
                Qualquer membro pode compartilhar a tela com o grupo.
              </p>
            </div>
            <button type="button" onClick={() => void startHosting()} className="app-button-primary">
              Iniciar transmissão
            </button>
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
