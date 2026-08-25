"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import {
  endLiveStreamAction,
  getActiveLiveStreamAction,
  heartbeatLiveStreamAction,
  reportLiveStreamUsageAction,
  startLiveStreamAction,
} from "@/app/app/groups/live-actions";
import { getPublicEnv } from "@/lib/env";
import {
  AdaptiveFrameRateController,
  attemptVideoPlayback,
  calculatePacketLossRate,
  closePeerConnection,
  hasDisplayAudio as streamHasDisplayAudio,
  LIVE_HEARTBEAT_INTERVAL_MS,
  MAX_LIVE_VIEWERS,
  LIVE_STATS_INTERVAL_MS,
  type LiveStreamSession,
  type PacketCounters,
  stopMediaStream,
} from "@/lib/live-stream";
import {
  LIVE_USAGE_REPORT_INTERVAL_MS,
  type LiveStreamUsageStatus,
} from "@/lib/live-stream-usage";
import { createClient } from "@/lib/supabase/browser";

type ViewState = "idle" | "starting" | "hosting" | "connecting" | "watching" | "connection-failed" | "ended";
type RealtimeToken = { accessToken: string; expiresAt?: number; userId: string };
type SfuDescription = { type: "offer" | "answer"; sdp: string };
type SfuSubscribeResponse = {
  sfuSessionId: string;
  connectionToken: string;
  sessionDescription: SfuDescription;
};
type DisplayMediaOptionsWithAudioHints = DisplayMediaStreamOptions & {
  systemAudio?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  windowAudio?: "exclude" | "window" | "system";
};

function subscribe(channel: RealtimeChannel) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Realtime subscription timed out")), 10_000);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timeout);
        resolve();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        window.clearTimeout(timeout);
        reject(error ?? new Error(`Realtime subscription failed: ${status}`));
      }
    });
  });
}

async function waitForIceGathering(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(finish, 5_000);
    function finish() {
      window.clearTimeout(timeout);
      connection.removeEventListener("icegatheringstatechange", handleChange);
      resolve();
    }
    function handleChange() {
      if (connection.iceGatheringState === "complete") finish();
    }
    connection.addEventListener("icegatheringstatechange", handleChange);
  });
}

async function callSfu<T>(body: object): Promise<T> {
  const response = await fetch("/api/live-stream/sfu", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Não foi possível conectar à transmissão.");
  return result;
}

function localDescription(connection: RTCPeerConnection): SfuDescription {
  const description = connection.localDescription;
  if (!description?.sdp || !["offer", "answer"].includes(description.type)) {
    throw new Error("A negociação WebRTC não produziu uma descrição válida.");
  }
  return { type: description.type as "offer" | "answer", sdp: description.sdp };
}

export function LiveStreamPanel({ groupId, userId, initialSession, initialUsageStatus }: {
  groupId: string;
  userId: string;
  initialSession: LiveStreamSession | null;
  initialUsageStatus: LiveStreamUsageStatus;
}) {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [availableSession, setAvailableSession] = useState(initialSession);
  const [errorMessage, setErrorMessage] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [hasDisplayAudio, setHasDisplayAudio] = useState(false);
  const [frameRate, setFrameRate] = useState<30 | 60>(60);
  const [needsAudioActivation, setNeedsAudioActivation] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [usageStatus, setUsageStatus] = useState(initialUsageStatus);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const baseChannelRef = useRef<RealtimeChannel | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostSessionRef = useRef<LiveStreamSession | null>(null);
  const refreshTokenTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const statsTimerRef = useRef<number | null>(null);
  const usageReportTimerRef = useRef<number | null>(null);
  const hostMissingTimerRef = useRef<number | null>(null);
  const packetCountersRef = useRef<PacketCounters | undefined>(undefined);
  const qualityControllerRef = useRef(new AdaptiveFrameRateController());
  const endingRef = useRef(false);
  const usageReportFailuresRef = useRef(0);
  const rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: getPublicEnv().NEXT_PUBLIC_WEBRTC_STUN_URL }],
  };

  function clearTimer(ref: React.MutableRefObject<number | null>) {
    if (ref.current !== null) window.clearInterval(ref.current);
    ref.current = null;
  }

  async function authenticateRealtime(client: SupabaseClient) {
    const response = await fetch("/api/realtime/token", { method: "POST", cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Realtime authentication failed");
    const token = await response.json() as RealtimeToken;
    if (!token.accessToken || token.userId !== userId) throw new Error("Realtime token does not match the current user");
    await client.realtime.setAuth(token.accessToken);
    if (refreshTokenTimerRef.current !== null) window.clearTimeout(refreshTokenTimerRef.current);
    const expiresAt = (token.expiresAt ?? Math.floor(Date.now() / 1_000) + 300) * 1_000;
    refreshTokenTimerRef.current = window.setTimeout(() => {
      void authenticateRealtime(client).catch(() => setErrorMessage("A autenticação da transmissão expirou. Recarregue a página."));
    }, Math.max(30_000, expiresAt - Date.now() - 60_000));
  }

  async function getRealtimeClient() {
    const client = clientRef.current ?? createClient();
    clientRef.current = client;
    await authenticateRealtime(client);
    return client;
  }

  async function setupPresence(session: LiveStreamSession, role: "host" | "viewer") {
    const client = await getRealtimeClient();
    const channel = client.channel(`live:${session.id}`, { config: { private: true, presence: { key: userId } } });
    let initialPresenceSettled = false;
    let resolveInitialPresence!: () => void;
    let rejectInitialPresence!: (error: Error) => void;
    const initialPresence = new Promise<void>((resolve, reject) => {
      resolveInitialPresence = resolve;
      rejectInitialPresence = reject;
    });
    const initialPresenceTimeout = window.setTimeout(() => {
      if (initialPresenceSettled) return;
      initialPresenceSettled = true;
      rejectInitialPresence(new Error("Não foi possível confirmar sua entrada na transmissão."));
    }, 10_000);
    const syncPresence = () => {
      const state = channel.presenceState();
      setParticipantCount(Math.max(1, Object.keys(state).length));
      if (role !== "viewer") return;

      const admittedViewerIds = Object.entries(state)
        .filter(([presenceUserId]) => presenceUserId !== session.hostUserId)
        .map(([presenceUserId, presences]) => ({
          presenceUserId,
          joinedAt: String((presences[0] as { joined_at?: string } | undefined)?.joined_at ?? ""),
        }))
        .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt) || left.presenceUserId.localeCompare(right.presenceUserId))
        .slice(0, MAX_LIVE_VIEWERS)
        .map(({ presenceUserId }) => presenceUserId);

      if (state[userId] && !admittedViewerIds.includes(userId)) {
        const capacityError = new Error(`A transmissão atingiu o limite de ${MAX_LIVE_VIEWERS} espectadores.`);
        if (!initialPresenceSettled) {
          initialPresenceSettled = true;
          window.clearTimeout(initialPresenceTimeout);
          rejectInitialPresence(capacityError);
        } else {
          cleanupResources(false);
          setViewState("connection-failed");
          setErrorMessage(capacityError.message);
        }
        return;
      }

      if (state[userId] && !initialPresenceSettled) {
        initialPresenceSettled = true;
        window.clearTimeout(initialPresenceTimeout);
        resolveInitialPresence();
      }
      if (state[session.hostUserId]) {
        clearTimer(hostMissingTimerRef);
      } else if (hostMissingTimerRef.current === null) {
        hostMissingTimerRef.current = window.setTimeout(() => {
          cleanupResources(false);
          setAvailableSession(null);
          setViewState("ended");
        }, 5_000);
      }
    };
    channel.on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence);
    baseChannelRef.current = channel;
    try {
      await subscribe(channel);
      await channel.track({ user_id: userId, role, joined_at: new Date().toISOString() });
      if (role === "viewer") await initialPresence;
    } finally {
      window.clearTimeout(initialPresenceTimeout);
    }
  }

  function cleanupResources(stopLocalTracks: boolean) {
    clearTimer(heartbeatTimerRef);
    clearTimer(statsTimerRef);
    clearTimer(usageReportTimerRef);
    clearTimer(hostMissingTimerRef);
    if (refreshTokenTimerRef.current !== null) {
      window.clearTimeout(refreshTokenTimerRef.current);
      refreshTokenTimerRef.current = null;
    }
    closePeerConnection(peerRef.current);
    peerRef.current = null;
    packetCountersRef.current = undefined;
    usageReportFailuresRef.current = 0;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (clientRef.current && baseChannelRef.current) void clientRef.current.removeChannel(baseChannelRef.current);
    baseChannelRef.current = null;
    if (stopLocalTracks) {
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
    }
    setParticipantCount(1);
  }

  async function applyFrameRate(nextFrameRate: 30 | 60) {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ frameRate: { ideal: nextFrameRate, max: nextFrameRate } });
      setFrameRate(nextFrameRate);
    } catch {
      // Preserve the browser-selected rate when constraints cannot be changed.
    }
  }

  async function sampleHostStats() {
    const reports = await peerRef.current?.getStats().catch(() => null);
    if (!reports) return;
    let sent = 0;
    let lost = 0;
    reports.forEach((report) => {
      const kind = report.kind ?? report.mediaType;
      if (kind !== "video") return;
      if (report.type === "outbound-rtp") sent += report.packetsSent ?? 0;
      if (report.type === "remote-inbound-rtp") lost += report.packetsLost ?? 0;
    });
    const current = { sent, lost };
    const lossRate = calculatePacketLossRate(packetCountersRef.current, current);
    packetCountersRef.current = current;
    if (lossRate === null) return;
    const nextFrameRate = qualityControllerRef.current.observe(lossRate);
    if (nextFrameRate) await applyFrameRate(nextFrameRate);
  }

  async function reportViewerUsage(sessionId: string) {
    const reports = await peerRef.current?.getStats().catch(() => null);
    if (!reports) return;
    let totalBytes = 0;
    reports.forEach((report) => {
      if (report.type === "inbound-rtp") totalBytes += report.bytesReceived ?? 0;
    });
    const result = await reportLiveStreamUsageAction(sessionId, Math.round(totalBytes));
    if (result.ok) {
      usageReportFailuresRef.current = 0;
      return;
    }
    usageReportFailuresRef.current += 1;
    if (usageReportFailuresRef.current < 3) return;
    cleanupResources(false);
    setViewState("connection-failed");
    setErrorMessage("A medição de consumo da transmissão foi interrompida.");
  }

  async function endHosting() {
    const session = hostSessionRef.current;
    if (!session || endingRef.current) return;
    endingRef.current = true;
    const result = await endLiveStreamAction(session.id);
    cleanupResources(true);
    hostSessionRef.current = null;
    setAvailableSession(null);
    setViewState("ended");
    if (!result.ok) setErrorMessage(result.error);
    endingRef.current = false;
  }

  async function startHosting() {
    setErrorMessage("");
    setViewState("starting");
    let stream: MediaStream;
    try {
      const displayMediaOptions: DisplayMediaOptionsWithAudioHints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
        audio: true,
        systemAudio: "include",
        windowAudio: "system",
        surfaceSwitching: "include",
      };
      stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (error) {
      setViewState("idle");
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) setErrorMessage("Não foi possível acessar a tela selecionada.");
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setHasDisplayAudio(streamHasDisplayAudio(stream));
    setFrameRate(60);
    qualityControllerRef.current = new AdaptiveFrameRateController();
    stream.getVideoTracks()[0].addEventListener("ended", () => void endHosting(), { once: true });
    const result = await startLiveStreamAction(groupId);
    if (!result.ok) {
      cleanupResources(true);
      setViewState("idle");
      setErrorMessage(result.error);
      if (result.code) {
        setUsageStatus((current) => ({
          ...current,
          canStart: false,
          canSubscribe: false,
          monitoringAvailable: result.code !== "monitoring-unavailable",
          level: result.code === "monitoring-unavailable" ? "monitoring-unavailable" : "blocked",
        }));
      }
      return;
    }
    const session = result.data;
    hostSessionRef.current = session;
    endingRef.current = false;

    try {
      await setupPresence(session, "host");
      const connection = new RTCPeerConnection(rtcConfig);
      peerRef.current = connection;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "failed") {
          setErrorMessage("A conexão do host com o servidor de mídia foi interrompida.");
          void endHosting();
        }
      };
      await connection.setLocalDescription(await connection.createOffer());
      await waitForIceGathering(connection);
      const published = await callSfu<{ sessionDescription: SfuDescription }>({
        operation: "publish",
        liveSessionId: session.id,
        sessionDescription: localDescription(connection),
      });
      await connection.setRemoteDescription(published.sessionDescription);
      setAvailableSession(session);
      setViewState("hosting");
      heartbeatTimerRef.current = window.setInterval(() => {
        void heartbeatLiveStreamAction(session.id).then((heartbeat) => {
          if (heartbeat.ok) return;
          if (heartbeat.code === "usage-limit") {
            setUsageStatus((current) => ({
              ...current,
              canStart: false,
              canSubscribe: false,
              mustEndActiveStreams: true,
              level: "hard-stop",
            }));
            setErrorMessage(heartbeat.error);
          }
          void endHosting();
        });
      }, LIVE_HEARTBEAT_INTERVAL_MS);
      statsTimerRef.current = window.setInterval(() => void sampleHostStats(), LIVE_STATS_INTERVAL_MS);
    } catch (error) {
      await endLiveStreamAction(session.id);
      cleanupResources(true);
      hostSessionRef.current = null;
      setAvailableSession(null);
      setViewState("connection-failed");
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível iniciar a transmissão.");
    }
  }

  async function watchStream() {
    const session = availableSession;
    if (!session) return;
    cleanupResources(false);
    setErrorMessage("");
    setViewState("connecting");
    try {
      const connection = new RTCPeerConnection(rtcConfig);
      peerRef.current = connection;
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      connection.ontrack = async ({ track }) => {
        if (!remoteStream.getTracks().some((current) => current.id === track.id)) remoteStream.addTrack(track);
        if (!remoteVideoRef.current) return;
        remoteVideoRef.current.srcObject = remoteStream;
        setNeedsAudioActivation(!(await attemptVideoPlayback(remoteVideoRef.current)));
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") setViewState("watching");
        else if (connection.connectionState === "failed") {
          cleanupResources(false);
          setViewState("connection-failed");
          setErrorMessage("Não foi possível conectar ao servidor de mídia.");
        }
      };
      const subscribed = await callSfu<SfuSubscribeResponse>({ operation: "subscribe", liveSessionId: session.id });
      await connection.setRemoteDescription(subscribed.sessionDescription);
      await connection.setLocalDescription(await connection.createAnswer());
      await waitForIceGathering(connection);
      await callSfu({
        operation: "renegotiate",
        liveSessionId: session.id,
        sfuSessionId: subscribed.sfuSessionId,
        connectionToken: subscribed.connectionToken,
        sessionDescription: localDescription(connection),
      });
      await setupPresence(session, "viewer");
      await reportViewerUsage(session.id);
      usageReportTimerRef.current = window.setInterval(
        () => void reportViewerUsage(session.id),
        LIVE_USAGE_REPORT_INTERVAL_MS,
      );
    } catch (error) {
      cleanupResources(false);
      setViewState("connection-failed");
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível assistir à transmissão.");
    }
  }

  async function endPreviousHostSession() {
    if (!availableSession || availableSession.hostUserId !== userId) return;
    const result = await endLiveStreamAction(availableSession.id);
    if (result.ok) {
      setAvailableSession(null);
      setViewState("ended");
    } else setErrorMessage(result.error);
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
      setUsageStatus(result.data.usage);
      setAvailableSession(result.data.session);
      if (["connecting", "watching", "connection-failed"].includes(viewState) && !result.data.session) {
        cleanupResources(false);
        setViewState("ended");
      }
    };
    void poll();
    const interval = window.setInterval(poll, 5_000);
    return () => { cancelled = true; window.clearInterval(interval); };
    // Mutable transport resources are intentionally read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, viewState]);

  useEffect(() => {
    const handlePageHide = () => {
      const session = hostSessionRef.current;
      if (!session || endingRef.current) return;
      navigator.sendBeacon("/api/live-stream/end", new Blob([JSON.stringify({ sessionId: session.id })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      handlePageHide();
      window.removeEventListener("pagehide", handlePageHide);
      cleanupResources(true);
    };
    // Lifecycle resources are intentionally read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHost = availableSession?.hostUserId === userId;
  const activeState = availableSession || ["starting", "hosting", "connecting", "watching"].includes(viewState);

  if (!usageStatus.canStart && !availableSession && !activeState) return null;

  return (
    <section aria-label="Transmissão de tela" className="mt-8 overflow-hidden rounded-2xl border bg-(--surface) shadow-sm">
      {activeState && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500">
            <span className="size-2 rounded-full bg-red-500" /> AO VIVO
          </span>
          {(viewState === "hosting" || viewState === "watching") && (
            <span className="text-sm text-(--muted)">{participantCount} {participantCount === 1 ? "participante" : "participantes"}</span>
          )}
        </div>
      )}
      <div className="p-5 sm:p-6">
        {viewState === "hosting" ? (
          <div className="space-y-4">
            <video ref={localVideoRef} autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-black object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-(--muted)">
                <span className="rounded-full bg-(--surface-muted) px-3 py-1.5">Qualidade: {frameRate} fps</span>
                <span className="rounded-full bg-(--surface-muted) px-3 py-1.5">
                  {hasDisplayAudio ? "Áudio: compartilhando" : "Sem áudio — reinicie e marque Compartilhar áudio"}
                </span>
              </div>
              <button type="button" onClick={() => void endHosting()} className="app-button-secondary text-red-500">Encerrar transmissão</button>
            </div>
          </div>
        ) : ["connecting", "watching"].includes(viewState) ? (
          <div className="space-y-4">
            <video ref={remoteVideoRef} autoPlay playsInline className="aspect-video w-full rounded-xl bg-black object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-(--muted)">{viewState === "connecting" ? "Conectando ao servidor de mídia…" : `${availableSession?.hostName ?? "Um membro"} está compartilhando a tela.`}</p>
              {needsAudioActivation && (
                <button type="button" className="app-button-primary" onClick={async () => {
                  if (!remoteVideoRef.current) return;
                  setNeedsAudioActivation(!(await attemptVideoPlayback(remoteVideoRef.current)));
                }}>Ativar áudio</button>
              )}
            </div>
          </div>
        ) : viewState === "connection-failed" ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Não foi possível conectar à transmissão.</p>
              <p className="mt-1 text-sm text-(--muted)">{errorMessage || "Tente novamente em alguns instantes."}</p>
            </div>
            {availableSession && !isHost && <button type="button" onClick={() => void watchStream()} className="app-button-primary">Tentar novamente</button>}
          </div>
        ) : availableSession ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">{availableSession.hostName} está compartilhando a tela.</p>
              <p className="mt-1 text-sm text-(--muted)">A mídia será distribuída pelo servidor WebRTC.</p>
            </div>
            {isHost ? (
              <button type="button" onClick={() => void endPreviousHostSession()} className="app-button-secondary text-red-500">Encerrar minha transmissão</button>
            ) : usageStatus.canSubscribe ? (
              <button type="button" onClick={() => void watchStream()} className="app-button-primary">Assistir</button>
            ) : (
              <p className="text-sm text-(--muted)">Novos espectadores estão temporariamente indisponíveis.</p>
            )}
          </div>
        ) : viewState === "starting" ? (
          <p className="text-sm text-(--muted)">Preparando a transmissão…</p>
        ) : viewState === "ended" ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm text-(--muted)">A transmissão foi encerrada.</p>
            <button type="button" onClick={() => setViewState("idle")} className="app-button-secondary">Fechar</button>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">Nenhuma transmissão ativa.</p>
                <span className="new-feature-badge" aria-label="Novo recurso">NEW</span>
              </div>
              <p className="mt-1 text-sm text-(--muted)">Qualquer membro pode compartilhar a tela com o grupo.</p>
            </div>
            <button type="button" onClick={() => void startHosting()} className="app-button-primary">Iniciar transmissão</button>
          </div>
        )}
        {errorMessage && viewState !== "connection-failed" && <p role="alert" className="mt-4 text-sm text-red-500">{errorMessage}</p>}
      </div>
    </section>
  );
}
