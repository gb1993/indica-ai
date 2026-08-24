"use server";

import { revalidatePath } from "next/cache";

import type { LiveStreamSession } from "@/lib/live-stream";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

type LiveActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function loadLiveSession(
  sessionId: string,
): Promise<LiveStreamSession | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("live_stream_sessions")
    .select("id, group_id, host_user_id, started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return null;

  const { data: host } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", session.host_user_id)
    .maybeSingle();

  return {
    id: session.id,
    groupId: session.group_id,
    hostUserId: session.host_user_id,
    hostName: host?.name ?? "Um membro",
    startedAt: session.started_at,
  };
}

export async function getActiveLiveStreamAction(
  groupIdValue: string,
): Promise<LiveActionResult<LiveStreamSession | null>> {
  const groupId = uuidSchema.safeParse(groupIdValue);
  if (!groupId.success) return { ok: false, error: "Grupo inválido." };

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const { data: session, error } = await supabase
    .from("live_stream_sessions")
    .select("id")
    .eq("group_id", groupId.data)
    .eq("status", "live")
    .gte("last_heartbeat_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Não foi possível consultar a transmissão." };
  }

  return {
    ok: true,
    data: session ? await loadLiveSession(session.id) : null,
  };
}

export async function startLiveStreamAction(
  groupIdValue: string,
): Promise<LiveActionResult<LiveStreamSession>> {
  const groupId = uuidSchema.safeParse(groupIdValue);
  if (!groupId.success) return { ok: false, error: "Grupo inválido." };

  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc("start_live_stream", {
    p_group_id: groupId.data,
  });

  if (error || !sessionId) {
    const alreadyActive = error?.message.includes("already active");
    return {
      ok: false,
      error: alreadyActive
        ? "Este grupo já possui uma transmissão ativa."
        : "Não foi possível iniciar a transmissão.",
    };
  }

  const session = await loadLiveSession(sessionId as string);
  if (!session) {
    return { ok: false, error: "A sessão criada não pôde ser carregada." };
  }

  revalidatePath(`/app/groups/${groupId.data}`);
  return { ok: true, data: session };
}

export async function activateLiveStreamAction(
  sessionIdValue: string,
): Promise<LiveActionResult> {
  const sessionId = uuidSchema.safeParse(sessionIdValue);
  if (!sessionId.success) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_live_stream", {
    p_session_id: sessionId.data,
  });
  if (error) {
    return { ok: false, error: "Não foi possível ativar a transmissão." };
  }

  const session = await loadLiveSession(sessionId.data);
  if (session) revalidatePath(`/app/groups/${session.groupId}`);
  return { ok: true, data: undefined };
}

export async function heartbeatLiveStreamAction(
  sessionIdValue: string,
): Promise<LiveActionResult> {
  const sessionId = uuidSchema.safeParse(sessionIdValue);
  if (!sessionId.success) return { ok: false, error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("heartbeat_live_stream", {
    p_session_id: sessionId.data,
  });
  return error
    ? { ok: false, error: "A transmissão perdeu o heartbeat." }
    : { ok: true, data: undefined };
}

export async function endLiveStreamAction(
  sessionIdValue: string,
): Promise<LiveActionResult> {
  const sessionId = uuidSchema.safeParse(sessionIdValue);
  if (!sessionId.success) return { ok: false, error: "Sessão inválida." };

  const session = await loadLiveSession(sessionId.data);
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_live_stream", {
    p_session_id: sessionId.data,
  });
  if (error) {
    return { ok: false, error: "Somente o host pode encerrar a transmissão." };
  }

  if (session) revalidatePath(`/app/groups/${session.groupId}`);
  return { ok: true, data: undefined };
}
