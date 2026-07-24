import assert from "node:assert/strict";
import test from "node:test";

import { groupInvitationEmailText } from "./group-invitation-content.ts";

test("gera alternativa em texto puro com grupo, validade e URL", () => {
  const text = groupInvitationEmailText({
    groupName: "Cinema & Companhia",
    inviteUrl: "https://example.com/invite/token-seguro",
    expiresInMinutes: 10,
  });

  assert.match(text, /Cinema & Companhia/);
  assert.match(text, /10 minutos/);
  assert.match(text, /https:\/\/example\.com\/invite\/token-seguro/);
  assert.doesNotMatch(text, /<[^>]+>/);
});

test("usa cinco minutos como validade padrão", () => {
  const text = groupInvitationEmailText({
    groupName: "CineClub",
    inviteUrl: "http://localhost:3000/invite/token",
  });

  assert.match(text, /5 minutos/);
});
