import { createHmac, timingSafeEqual } from "node:crypto";

type SfuConnectionTokenPayload = {
  liveSessionId: string;
  sfuSessionId: string;
  userId: string;
  expiresAt: number;
};

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSfuConnectionToken(
  payload: Omit<SfuConnectionTokenPayload, "expiresAt">,
  secret: string,
  now = Date.now(),
) {
  const encoded = Buffer.from(JSON.stringify({
    ...payload,
    expiresAt: now + 10 * 60_000,
  })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySfuConnectionToken(
  token: string,
  expected: Omit<SfuConnectionTokenPayload, "expiresAt">,
  secret: string,
  now = Date.now(),
) {
  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) return false;
  const expectedSignature = signature(encoded, secret);
  const provided = Buffer.from(providedSignature);
  const calculated = Buffer.from(expectedSignature);
  if (provided.length !== calculated.length || !timingSafeEqual(provided, calculated)) {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SfuConnectionTokenPayload;
    return payload.liveSessionId === expected.liveSessionId
      && payload.sfuSessionId === expected.sfuSessionId
      && payload.userId === expected.userId
      && Number.isFinite(payload.expiresAt)
      && payload.expiresAt >= now;
  } catch {
    return false;
  }
}
