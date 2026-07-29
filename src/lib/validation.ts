import { createHash } from "node:crypto";

import { z } from "zod";

import type { ActionState } from "./action-state.ts";
import { CONTENT_TYPES, normalizeYouTubeVideoId } from "./content.ts";

// PostgreSQL accepts canonical UUID values regardless of the RFC version nibble.
// Seed fixtures intentionally use deterministic zero-filled UUIDs, so validation
// mirrors the database instead of rejecting otherwise valid PostgreSQL UUIDs.
export const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Identificador inválido.",
);

export const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("Informe um e-mail válido.").max(254),
);

export const requestCodeSchema = z.object({
  email: emailSchema,
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  token: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\s/g, "") : value),
    z.string().regex(/^\d{6,10}$/, "Informe o código numérico recebido por e-mail."),
  ),
  next: z.string().max(300).optional(),
});

export function safeNextPath(value: unknown) {
  if (typeof value !== "string") return "/dashboard";
  return value.startsWith("/invite/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export const groupSchema = z.object({
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres.").max(80),
  description: z.string().trim().max(500, "A descrição deve ter no máximo 500 caracteres."),
});

export const profileNameSchema = z.object({
  name: z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(80, "O nome deve ter no máximo 80 caracteres."))
    .refine((value) => !/[<>]/.test(value), "O nome deve conter somente texto, sem HTML."),
});

export const invitationSchema = z.object({
  groupId: uuidSchema,
  email: z.email("Informe um e-mail válido.").max(254).transform((value) => value.toLowerCase()),
});

export const invitationTokenSchema = z.string().min(32).max(256);

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function actionError(message: string, error?: z.ZodError): ActionState {
  return {
    status: "error",
    message,
    fieldErrors: error ? z.flattenError(error).fieldErrors : undefined,
  };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const ratingSchema = z.object({
  groupId: uuidSchema,
  contentId: uuidSchema,
  rating: z.coerce.number().int("A avaliação deve ser um número inteiro.").min(1).max(5),
  comment: z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(500, "O comentário deve ter no máximo 500 caracteres."))
    .refine((value) => !/[<>]/.test(value), "O comentário deve conter somente texto, sem HTML."),
});

const messageContentSchema = z.string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, "Escreva uma mensagem.").max(2000, "A mensagem deve ter no máximo 2.000 caracteres."))
  .refine((value) => !/[<>]/.test(value), "A mensagem deve conter somente texto, sem HTML.");

export const newMessageSchema = z.object({
  groupId: uuidSchema,
  contentId: uuidSchema,
  content: messageContentSchema,
});

export const editMessageSchema = newMessageSchema.extend({
  messageId: uuidSchema,
});

export const deleteMessageSchema = z.object({
  groupId: uuidSchema,
  contentId: uuidSchema,
  messageId: uuidSchema,
});

export function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const contentSchema = z.object({
  groupId: uuidSchema,
  type: z.enum(CONTENT_TYPES),
  title: z.string().trim().min(1, "Informe o título.").max(160, "O título deve ter no máximo 160 caracteres."),
  description: z.string().trim().max(4000, "A descrição deve ter no máximo 4.000 caracteres.").refine(
    (value) => !/[<>]/.test(value),
    "A descrição deve conter somente texto, sem HTML.",
  ),
  thumbnailUrl: z.string().trim().max(2048).refine(
    (value) => !value || isSafeHttpsUrl(value),
    "Informe uma URL HTTPS válida para a thumbnail.",
  ),
  trailerUrl: z.string().trim().max(2048),
}).superRefine((value, context) => {
  if (value.trailerUrl && !normalizeYouTubeVideoId(value.trailerUrl)) {
    context.addIssue({
      code: "custom",
      path: ["trailerUrl"],
      message: "Informe um link HTTPS válido do YouTube.",
    });
  }
});

export const tmdbSearchSchema = z.object({
  groupId: uuidSchema,
  query: z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Digite pelo menos 2 caracteres.").max(80)),
});

export const tmdbSelectionSchema = z.object({
  groupId: uuidSchema,
  tmdbId: z.coerce.number().int().positive(),
  tmdbMediaType: z.enum(["movie", "tv"]),
});

export function parseContentForm(formData: FormData) {
  return contentSchema.safeParse({
    groupId: formString(formData, "groupId"),
    type: formString(formData, "type"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    thumbnailUrl: formString(formData, "thumbnailUrl"),
    trailerUrl: formString(formData, "trailerUrl"),
  });
}
