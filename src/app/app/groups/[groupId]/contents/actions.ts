"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import {
  CONTENT_TYPES,
  normalizeYouTubeVideoId,
} from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.uuid();
const voteSchema = z.object({
  groupId: uuidSchema,
  contentId: uuidSchema,
  vote: z.enum(["true", "false"]).transform((value) => value === "true"),
});
const ratingSchema = z.object({
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
const newMessageSchema = z.object({
  groupId: uuidSchema,
  contentId: uuidSchema,
  content: messageContentSchema,
});
const editMessageSchema = newMessageSchema.extend({
  messageId: uuidSchema,
});

export type ContentVoteSummary = {
  favorable_votes: number;
  contrary_votes: number;
  active_members: number;
  current_user_vote: boolean | null;
  favorable_votes_needed: number;
  content_status: "pending" | "approved" | "completed";
};

export type ContentRatingSummary = {
  average_rating: number | null;
  rating_count: number;
  current_user_rating: number | null;
};

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const contentSchema = z.object({
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
  if (value.type === "book") {
    if (value.trailerUrl) {
      context.addIssue({
        code: "custom",
        path: ["trailerUrl"],
        message: "Livros não possuem trailer.",
      });
    }
    return;
  }

  if (value.trailerUrl && !normalizeYouTubeVideoId(value.trailerUrl)) {
    context.addIssue({
      code: "custom",
      path: ["trailerUrl"],
      message: "Informe um link HTTPS válido do YouTube.",
    });
  }
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function actionError(message: string, error?: z.ZodError): ActionState {
  return {
    status: "error",
    message,
    fieldErrors: error ? z.flattenError(error).fieldErrors : undefined,
  };
}

function parseContent(formData: FormData) {
  return contentSchema.safeParse({
    groupId: formString(formData, "groupId"),
    type: formString(formData, "type"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    thumbnailUrl: formString(formData, "thumbnailUrl"),
    trailerUrl: formString(formData, "trailerUrl"),
  });
}

export async function createContent(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseContent(formData);
  if (!parsed.success) return actionError("Revise os dados do conteúdo.", parsed.error);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return actionError("Sua sessão expirou. Entre novamente.");

  const trailerId = parsed.data.type === "book"
    ? null
    : normalizeYouTubeVideoId(parsed.data.trailerUrl);

  const { data, error } = await supabase
    .from("contents")
    .insert({
      group_id: parsed.data.groupId,
      created_by: authData.user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      thumbnail_url: parsed.data.thumbnailUrl || null,
      trailer_url: trailerId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("Não foi possível cadastrar o conteúdo. Verifique seu acesso ao grupo.");
  }

  revalidatePath(`/app/groups/${parsed.data.groupId}`);
  redirect(`/app/groups/${parsed.data.groupId}/contents/${data.id}`);
}

export async function updateContent(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const contentId = uuidSchema.safeParse(formString(formData, "contentId"));
  const parsed = parseContent(formData);
  if (!contentId.success || !parsed.success) {
    return actionError(
      "Revise os dados do conteúdo.",
      parsed.success ? undefined : parsed.error,
    );
  }

  const trailerId = parsed.data.type === "book"
    ? null
    : normalizeYouTubeVideoId(parsed.data.trailerUrl);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contents")
    .update({
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      thumbnail_url: parsed.data.thumbnailUrl || null,
      trailer_url: trailerId,
    })
    .eq("id", contentId.data)
    .eq("group_id", parsed.data.groupId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return actionError("Somente o autor pode editar o próprio conteúdo enquanto ele estiver pendente.");
  }

  revalidatePath(`/app/groups/${parsed.data.groupId}`);
  revalidatePath(`/app/groups/${parsed.data.groupId}/contents/${contentId.data}`);
  return { status: "success", message: "Conteúdo atualizado." };
}

export async function deleteContent(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const contentId = uuidSchema.safeParse(formString(formData, "contentId"));
  if (!groupId.success || !contentId.success) return actionError("Conteúdo inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contents")
    .delete()
    .eq("id", contentId.data)
    .eq("group_id", groupId.data)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return actionError("Somente o autor pode excluir o próprio conteúdo enquanto ele estiver pendente.");
  }

  revalidatePath(`/app/groups/${groupId.data}`);
  redirect(`/app/groups/${groupId.data}`);
}

export async function setContentVote(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = voteSchema.safeParse({
    groupId: formString(formData, "groupId"),
    contentId: formString(formData, "contentId"),
    vote: formString(formData, "vote"),
  });
  if (!parsed.success) return actionError("Voto inválido.");

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("set_content_vote", {
    p_content_id: parsed.data.contentId,
    p_vote: parsed.data.vote,
  });

  if (error || !status) {
    return actionError("Não foi possível registrar o voto. A votação pode já estar encerrada.");
  }

  revalidatePath(`/app/groups/${parsed.data.groupId}`);
  revalidatePath(`/app/groups/${parsed.data.groupId}/contents/${parsed.data.contentId}`);
  return {
    status: "success",
    message: status === "approved"
      ? "Voto registrado. O conteúdo foi aprovado."
      : "Voto registrado.",
  };
}

export async function getContentVoteSummary(contentId: string): Promise<ContentVoteSummary | null> {
  const parsed = uuidSchema.safeParse(contentId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_content_vote_summary", {
    p_content_id: parsed.data,
  });
  if (error || !Array.isArray(data) || !data[0]) return null;

  return data[0] as ContentVoteSummary;
}

export async function completeContent(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const contentId = uuidSchema.safeParse(formString(formData, "contentId"));
  if (!groupId.success || !contentId.success) return actionError("Conteúdo inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_content", {
    p_content_id: contentId.data,
  });
  if (error) {
    return actionError("Não foi possível concluir o conteúdo. Ele precisa estar aprovado.");
  }

  revalidatePath(`/app/groups/${groupId.data}`);
  revalidatePath(`/app/groups/${groupId.data}/contents/${contentId.data}`);
  return { status: "success", message: "Conteúdo marcado como concluído." };
}

export async function setContentRating(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ratingSchema.safeParse({
    groupId: formString(formData, "groupId"),
    contentId: formString(formData, "contentId"),
    rating: formString(formData, "rating"),
    comment: formString(formData, "comment"),
  });
  if (!parsed.success) return actionError("Revise sua avaliação.", parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_content_rating", {
    p_content_id: parsed.data.contentId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment || null,
  });
  if (error) {
    return actionError("Não foi possível registrar a avaliação. O conteúdo precisa estar concluído.");
  }

  revalidatePath(`/app/groups/${parsed.data.groupId}`);
  revalidatePath(`/app/groups/${parsed.data.groupId}/contents/${parsed.data.contentId}`);
  return { status: "success", message: "Avaliação registrada." };
}

export async function getContentRatingSummary(contentId: string): Promise<ContentRatingSummary | null> {
  const parsed = uuidSchema.safeParse(contentId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_content_rating_summary", {
    p_content_id: parsed.data,
  });
  if (error || !Array.isArray(data) || !data[0]) return null;

  const summary = data[0] as {
    average_rating: number | string | null;
    rating_count: number;
    current_user_rating: number | null;
  };
  return {
    average_rating: summary.average_rating === null ? null : Number(summary.average_rating),
    rating_count: Number(summary.rating_count),
    current_user_rating: summary.current_user_rating === null
      ? null
      : Number(summary.current_user_rating),
  };
}

export async function createContentMessage(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newMessageSchema.safeParse({
    groupId: formString(formData, "groupId"),
    contentId: formString(formData, "contentId"),
    content: formString(formData, "content"),
  });
  if (!parsed.success) return actionError("Revise a mensagem.", parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_content_message", {
    p_content_id: parsed.data.contentId,
    p_content: parsed.data.content,
  });
  if (error) return actionError("Não foi possível publicar a mensagem.");

  revalidatePath(`/app/groups/${parsed.data.groupId}/contents/${parsed.data.contentId}`);
  return { status: "success", message: "Mensagem publicada." };
}

export async function updateContentMessage(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = editMessageSchema.safeParse({
    groupId: formString(formData, "groupId"),
    contentId: formString(formData, "contentId"),
    messageId: formString(formData, "messageId"),
    content: formString(formData, "content"),
  });
  if (!parsed.success) return actionError("Revise a mensagem.", parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_content_message", {
    p_message_id: parsed.data.messageId,
    p_content: parsed.data.content,
  });
  if (error) return actionError("Somente o autor pode editar uma mensagem ativa.");

  revalidatePath(`/app/groups/${parsed.data.groupId}/contents/${parsed.data.contentId}`);
  return { status: "success", message: "Mensagem atualizada." };
}

export async function deleteContentMessage(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z.object({
    groupId: uuidSchema,
    contentId: uuidSchema,
    messageId: uuidSchema,
  }).safeParse({
    groupId: formString(formData, "groupId"),
    contentId: formString(formData, "contentId"),
    messageId: formString(formData, "messageId"),
  });
  if (!parsed.success) return actionError("Mensagem inválida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_content_message", {
    p_message_id: parsed.data.messageId,
  });
  if (error) return actionError("Somente o autor pode excluir a própria mensagem.");

  revalidatePath(`/app/groups/${parsed.data.groupId}/contents/${parsed.data.contentId}`);
  return { status: "success", message: "Mensagem removida." };
}
