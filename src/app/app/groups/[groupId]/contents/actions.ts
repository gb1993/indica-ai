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

export type ContentVoteSummary = {
  favorable_votes: number;
  contrary_votes: number;
  active_members: number;
  current_user_vote: boolean | null;
  favorable_votes_needed: number;
  content_status: "pending" | "approved" | "completed";
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
