import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createClient,
  type RealtimeChannel,
  type RealtimeChannelSendResponse,
} from "@supabase/supabase-js";

function localSupabaseEnvironment() {
  const executable = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx.cmd supabase status -o env"]
    : ["supabase", "status", "-o", "env"];
  const output = execFileSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = new Map<string, string>();
  output.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
    if (match) values.set(match[1], match[2]);
  });
  const apiUrl = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase local environment is unavailable");
  }
  return { apiUrl, anonKey, serviceRoleKey };
}

function subscribeStatus(channel: RealtimeChannel) {
  return new Promise<{ status: string; error?: string }>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Realtime integration subscription timed out")),
      10_000,
    );
    channel.subscribe((status, error) => {
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(timeout);
        resolve({ status, error: error?.message });
      }
    });
  });
}

test("Realtime privado aplica membership e vincula signaling ao remetente", async (t) => {
  const { apiUrl, anonKey, serviceRoleKey } = localSupabaseEnvironment();
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const member = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const outsider = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID();
  const password = `Live-${randomUUID()}-Aa1!`;
  const memberEmail = `live-member-${suffix}@example.test`;
  const outsiderEmail = `live-outsider-${suffix}@example.test`;
  const createdUserIds: string[] = [];
  let groupId: string | null = null;
  let sessionId: string | null = null;

  t.after(async () => {
    await Promise.all([
      member.removeAllChannels(),
      outsider.removeAllChannels(),
    ]);
    if (sessionId) await member.rpc("end_live_stream", { p_session_id: sessionId });
    if (groupId) await admin.from("groups").delete().eq("id", groupId);
    await Promise.all(
      createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId)),
    );
  });

  for (const [email, name] of [
    [memberEmail, "Realtime Member"],
    [outsiderEmail, "Realtime Outsider"],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    assert.ifError(error);
    assert.ok(data.user);
    createdUserIds.push(data.user.id);
  }

  const memberLogin = await member.auth.signInWithPassword({
    email: memberEmail,
    password,
  });
  const outsiderLogin = await outsider.auth.signInWithPassword({
    email: outsiderEmail,
    password,
  });
  assert.ifError(memberLogin.error);
  assert.ifError(outsiderLogin.error);
  const memberUserId = memberLogin.data.user!.id;
  const outsiderUserId = outsiderLogin.data.user!.id;
  await member.realtime.setAuth(memberLogin.data.session!.access_token);
  await outsider.realtime.setAuth(outsiderLogin.data.session!.access_token);

  const createdGroup = await member.rpc("create_group", {
    p_name: `Realtime ${suffix.slice(0, 8)}`,
    p_description: null,
  });
  assert.ifError(createdGroup.error);
  groupId = createdGroup.data as string;

  const startedSession = await member.rpc("start_live_stream", {
    p_group_id: groupId,
  });
  assert.ifError(startedSession.error);
  sessionId = startedSession.data as string;
  const activated = await member.rpc("activate_live_stream", {
    p_session_id: sessionId,
  });
  assert.ifError(activated.error);

  const presence = member.channel(`live:${sessionId}`, {
    config: { private: true, presence: { key: memberUserId } },
  });
  const presenceSubscription = await subscribeStatus(presence);
  assert.equal(
    presenceSubscription.status,
    "SUBSCRIBED",
    presenceSubscription.error,
  );
  assert.equal(
    await presence.track({ user_id: memberUserId, role: "host" }),
    "ok",
  );

  const outsiderPresence = outsider.channel(`live:${sessionId}`, {
    config: { private: true, presence: { key: outsiderUserId } },
  });
  assert.notEqual(
    (await subscribeStatus(outsiderPresence)).status,
    "SUBSCRIBED",
  );

  const ownSignal = member.channel(
    `live:${sessionId}:signal:${memberUserId}`,
    { config: { private: true, broadcast: { ack: true } } },
  );
  const ownSubscription = await subscribeStatus(ownSignal);
  assert.equal(ownSubscription.status, "SUBSCRIBED", ownSubscription.error);
  const ownSend: RealtimeChannelSendResponse = await ownSignal.send({
    type: "broadcast",
    event: "integration-check",
    payload: { ok: true },
  });
  assert.equal(ownSend, "ok");

  const spoofedSignal = member.channel(
    `live:${sessionId}:signal:${outsiderUserId}`,
    { config: { private: true, broadcast: { ack: true } } },
  );
  const spoofedSubscription = await subscribeStatus(spoofedSignal);
  assert.equal(
    spoofedSubscription.status,
    "SUBSCRIBED",
    spoofedSubscription.error,
  );
  const spoofedSend: RealtimeChannelSendResponse = await spoofedSignal.send({
    type: "broadcast",
    event: "integration-check",
    payload: { ok: false },
  });
  assert.notEqual(spoofedSend, "ok");
});
