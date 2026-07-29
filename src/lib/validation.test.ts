import assert from "node:assert/strict";
import test from "node:test";

import {
  actionError,
  contentSchema,
  deleteMessageSchema,
  editMessageSchema,
  emailSchema,
  escapeHtml,
  formString,
  groupSchema,
  invitationHash,
  invitationSchema,
  invitationTokenSchema,
  isSafeHttpsUrl,
  newMessageSchema,
  parseContentForm,
  profileNameSchema,
  ratingSchema,
  requestCodeSchema,
  safeNextPath,
  verifyCodeSchema,
} from "./validation.ts";

const groupId = "82000000-0000-0000-0000-000000000003";
const contentId = "84000000-0000-0000-0000-000000000006";
const messageId = "85000000-0000-0000-0000-000000000001";
const youtubeId = "dQw4w9WgXcQ";

test("normaliza e valida e-mail e código de acesso", () => {
  assert.equal(emailSchema.parse("  USER@Example.COM "), "user@example.com");
  assert.equal(requestCodeSchema.parse({ email: " USER@EXAMPLE.COM " }).email, "user@example.com");
  assert.deepEqual(
    verifyCodeSchema.parse({
      email: "user@example.com",
      token: "12 34 56",
      next: "/invite/token",
    }),
    { email: "user@example.com", token: "123456", next: "/invite/token" },
  );
  assert.equal(emailSchema.safeParse("inválido").success, false);
  assert.equal(emailSchema.safeParse(42).success, false);
  assert.equal(verifyCodeSchema.safeParse({ email: "a@b.com", token: "abc" }).success, false);
  assert.equal(verifyCodeSchema.safeParse({ email: "a@b.com", token: "1".repeat(11) }).success, false);
});

test("restringe redirecionamento após login aos convites internos", () => {
  assert.equal(safeNextPath("/invite/abc"), "/invite/abc");
  assert.equal(safeNextPath("//evil.test/invite/a"), "/dashboard");
  assert.equal(safeNextPath("/app/profile"), "/dashboard");
  assert.equal(safeNextPath(null), "/dashboard");
});

test("valida dados de grupo, convite e token", () => {
  assert.deepEqual(groupSchema.parse({ name: "  Clube  ", description: "  Filmes  " }), {
    name: "Clube",
    description: "Filmes",
  });
  assert.equal(groupSchema.safeParse({ name: "A", description: "" }).success, false);
  assert.equal(groupSchema.safeParse({ name: "Grupo", description: "x".repeat(501) }).success, false);
  assert.equal(
    invitationSchema.parse({ groupId, email: "MEMBER@EXAMPLE.COM" }).email,
    "member@example.com",
  );
  assert.equal(invitationSchema.safeParse({ groupId: "x", email: "member@example.com" }).success, false);
  assert.equal(invitationSchema.safeParse({ groupId, email: "x" }).success, false);
  assert.equal(invitationTokenSchema.safeParse("a".repeat(32)).success, true);
  assert.equal(invitationTokenSchema.safeParse("curto").success, false);
});

test("normaliza e valida o nome do perfil", () => {
  assert.equal(
    profileNameSchema.parse({ name: "  Gabriel   Branco  " }).name,
    "Gabriel Branco",
  );
  assert.equal(profileNameSchema.safeParse({ name: "G" }).success, false);
  assert.equal(profileNameSchema.safeParse({ name: "x".repeat(81) }).success, false);
  assert.equal(profileNameSchema.safeParse({ name: "<b>Gabriel</b>" }).success, false);
});

test("extrai strings do FormData e produz erros de campo", () => {
  const formData = new FormData();
  formData.set("name", "Grupo");
  formData.set("file", new Blob(["x"]));
  assert.equal(formString(formData, "name"), "Grupo");
  assert.equal(formString(formData, "missing"), "");
  assert.equal(formString(formData, "file"), "");

  const parsed = groupSchema.safeParse({ name: "A", description: "" });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const state = actionError("Revise.", parsed.error);
    assert.equal(state.status, "error");
    assert.deepEqual(Object.keys(state.fieldErrors ?? {}), ["name"]);
  }
  assert.deepEqual(actionError("Falhou."), { status: "error", message: "Falhou.", fieldErrors: undefined });
});

test("escapa HTML e gera hash determinístico do convite", () => {
  assert.equal(
    escapeHtml(`<a title="x">Tom & Jerry's</a>`),
    "&lt;a title=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
  );
  assert.equal(
    invitationHash("token"),
    "3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0",
  );
});

test("aceita apenas URLs HTTPS sem credenciais", () => {
  assert.equal(isSafeHttpsUrl("https://images.example.com/poster.jpg"), true);
  assert.equal(isSafeHttpsUrl("http://images.example.com/poster.jpg"), false);
  assert.equal(isSafeHttpsUrl("https://user:pass@example.com/poster.jpg"), false);
  assert.equal(isSafeHttpsUrl("não é url"), false);
});

test("valida conteúdo de filme e normaliza o formulário", () => {
  const valid = {
    groupId,
    type: "movie",
    title: "  Filme  ",
    description: "  Descrição  ",
    thumbnailUrl: "https://images.example.com/poster.jpg",
    trailerUrl: `https://youtube.com/watch?v=${youtubeId}`,
  };
  const parsed = contentSchema.parse(valid);
  assert.equal(parsed.title, "Filme");
  assert.equal(parsed.description, "Descrição");

  const formData = new FormData();
  for (const [key, value] of Object.entries(valid)) formData.set(key, value);
  assert.equal(parseContentForm(formData).success, true);
});

test("rejeita conteúdo inseguro ou incompatível", () => {
  const base = {
    groupId,
    type: "movie",
    title: "Filme",
    description: "",
    thumbnailUrl: "",
    trailerUrl: "",
  };
  assert.equal(contentSchema.safeParse({ ...base, title: "" }).success, false);
  assert.equal(contentSchema.safeParse({ ...base, description: "<script>" }).success, false);
  assert.equal(contentSchema.safeParse({ ...base, thumbnailUrl: "http://example.com/a.jpg" }).success, false);
  assert.equal(contentSchema.safeParse({ ...base, trailerUrl: "https://example.com/video" }).success, false);
  assert.equal(contentSchema.safeParse({ ...base, type: "documentary", trailerUrl: `https://youtu.be/${youtubeId}` }).success, true);
  assert.equal(contentSchema.safeParse({ ...base, type: "series" }).success, true);
  assert.equal(contentSchema.safeParse({ ...base, type: "book" }).success, false);
  assert.equal(contentSchema.safeParse({ ...base, type: "game" }).success, false);
});

test("valida avaliação", () => {

  const rating = ratingSchema.parse({
    groupId,
    contentId,
    rating: "5",
    comment: "  Muito   bom  ",
  });
  assert.equal(rating.rating, 5);
  assert.equal(rating.comment, "Muito bom");
  assert.equal(ratingSchema.safeParse({ groupId, contentId, rating: "2.5", comment: "" }).success, false);
  assert.equal(ratingSchema.safeParse({ groupId, contentId, rating: "0", comment: "" }).success, false);
  assert.equal(ratingSchema.safeParse({ groupId, contentId, rating: "5", comment: "<b>bom</b>" }).success, false);
  assert.equal(ratingSchema.safeParse({ groupId, contentId, rating: "5", comment: "x".repeat(501) }).success, false);
});

test("normaliza mensagens e exige identificadores válidos", () => {
  const message = newMessageSchema.parse({
    groupId,
    contentId,
    content: "  Olá   grupo  ",
  });
  assert.equal(message.content, "Olá grupo");
  assert.equal(newMessageSchema.safeParse({ groupId, contentId, content: "   " }).success, false);
  assert.equal(newMessageSchema.safeParse({ groupId, contentId, content: "<b>oi</b>" }).success, false);
  assert.equal(newMessageSchema.safeParse({ groupId, contentId, content: "x".repeat(2001) }).success, false);
  assert.equal(editMessageSchema.safeParse({ groupId, contentId, messageId, content: "ok" }).success, true);
  assert.equal(editMessageSchema.safeParse({ groupId, contentId, messageId: "x", content: "ok" }).success, false);
  assert.equal(deleteMessageSchema.safeParse({ groupId, contentId, messageId }).success, true);
  assert.equal(deleteMessageSchema.safeParse({ groupId, contentId, messageId: "" }).success, false);
});
