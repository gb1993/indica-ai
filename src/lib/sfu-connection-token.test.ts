import assert from "node:assert/strict";
import test from "node:test";

import {
  createSfuConnectionToken,
  verifySfuConnectionToken,
} from "./sfu-connection-token.ts";

const connection = {
  liveSessionId: "10000000-0000-4000-8000-000000000001",
  sfuSessionId: "cloudflare-session",
  userId: "10000000-0000-4000-8000-000000000002",
};

test("assina e valida uma conexão SFU temporária", () => {
  const token = createSfuConnectionToken(connection, "secret", 1_000);
  assert.equal(verifySfuConnectionToken(token, connection, "secret", 2_000), true);
});

test("rejeita token expirado, adulterado ou de outro usuário", () => {
  const token = createSfuConnectionToken(connection, "secret", 1_000);
  assert.equal(verifySfuConnectionToken(token, connection, "secret", 601_001), false);
  assert.equal(verifySfuConnectionToken(`${token}x`, connection, "secret", 2_000), false);
  assert.equal(verifySfuConnectionToken(token, { ...connection, userId: "other" }, "secret", 2_000), false);
});
