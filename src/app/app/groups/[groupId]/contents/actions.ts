"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { normalizeYouTubeVideoId } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import {
  getTmdbDetails,
  searchTmdb,
  type TmdbContentDetails,
  type TmdbSearchResult,
} from "@/lib/tmdb";
import {
  actionError,
  deleteMessageSchema,
  editMessageSchema,
  formString,
  newMessageSchema,
  parseContentForm,
  ratingSchema,
  tmdbSearchSchema,
  tmdbSelectionSchema,
  uuidSchema,
} from "@/lib/validation";

export type ContentRatingSummary = {
  average_rating: number | null;
  rating_count: number;
  current_user_rating: number | null;
};

export type TmdbSearchState =
  | { status: "success"; results: TmdbSearchResult[] }
  | { status: "error"; message: string };

export type TmdbDetailsState =
  | { status: "success"; content: TmdbContentDetails }
  | { status: "error"; message: string };

async function hasGroupAccess(groupId: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return false;
  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();
  return Boolean(group);
}

export async function searchTmdbContents(
  groupId: string,
  query: string,
): Promise<TmdbSearchState> {
  const parsed = tmdbSearchSchema.safeParse({ groupId, query });
  if (!parsed.success) {
    return { status: "error", message: "Digite pelo menos 2 caracteres para pesquisar." };
  }
  if (!await hasGroupAccess(parsed.data.groupId)) {
    return { status: "error", message: "Grupo não encontrado ou acesso negado." };
  }

  try {
    return { status: "success", results: await searchTmdb(parsed.data.query) };
  } catch {
    console.error("TMDB content search failed");
    return {
      status: "error",
      message: "A busca no TMDB está indisponível. Preencha os dados manualmente.",
    };
  }
}

export async function loadTmdbContentDetails(
  groupId: string,
  tmdbId: number,
  tmdbMediaType: "movie" | "tv",
): Promise<TmdbDetailsState> {
  const parsed = tmdbSelectionSchema.safeParse({ groupId, tmdbId, tmdbMediaType });
  if (!parsed.success || !await hasGroupAccess(groupId)) {
    return { status: "error", message: "Conteúdo inválido ou acesso negado." };
  }

  try {
    return {
      status: "success",
      content: await getTmdbDetails(parsed.data.tmdbMediaType, parsed.data.tmdbId),
    };
  } catch {
    console.error("TMDB content details failed");
    return {
      status: "error",
      message: "Não foi possível carregar os dados. Preencha o conteúdo manualmente.",
    };
  }
}

export async function createContent(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return actionError("Sua sessão expirou. Entre novamente.");

  const sourceMode = formString(formData, "sourceMode");
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  if (!groupId.success) return actionError("Grupo inválido.");
  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("id", groupId.data)
    .maybeSingle();
  if (!group) return actionError("Grupo não encontrado ou acesso negado.");

  let values: {
    type: "movie" | "series" | "documentary";
    title: string;
    description: string | null;
    thumbnailUrl: string | null;
    trailerId: string | null;
    tmdbId: number | null;
    tmdbMediaType: "movie" | "tv" | null;
  };

  if (sourceMode === "tmdb") {
    const selection = tmdbSelectionSchema.safeParse({
      groupId: groupId.data,
      tmdbId: formString(formData, "tmdbId"),
      tmdbMediaType: formString(formData, "tmdbMediaType"),
    });
    if (!selection.success) return actionError("Selecione novamente um resultado do TMDB.");

    try {
      const details = await getTmdbDetails(
        selection.data.tmdbMediaType,
        selection.data.tmdbId,
      );
      values = {
        type: details.type,
        title: details.title,
        description: details.description || null,
        thumbnailUrl: details.thumbnailUrl,
        trailerId: normalizeYouTubeVideoId(details.trailerUrl ?? ""),
        tmdbId: details.tmdbId,
        tmdbMediaType: details.mediaType,
      };
    } catch {
      console.error("TMDB content refresh failed");
      return actionError(
        "Não foi possível confirmar os dados no TMDB. Tente novamente ou use o preenchimento manual.",
      );
    }
  } else if (sourceMode === "manual") {
    const parsed = parseContentForm(formData);
    if (!parsed.success) return actionError("Revise os dados do conteúdo.", parsed.error);
    values = {
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      trailerId: normalizeYouTubeVideoId(parsed.data.trailerUrl),
      tmdbId: null,
      tmdbMediaType: null,
    };
  } else {
    return actionError("Pesquise o conteúdo no TMDB antes de continuar.");
  }

  const { data, error } = await supabase
    .from("contents")
    .insert({
      group_id: groupId.data,
      created_by: authData.user.id,
      type: values.type,
      title: values.title,
      description: values.description,
      thumbnail_url: values.thumbnailUrl,
      trailer_url: values.trailerId,
      tmdb_id: values.tmdbId,
      tmdb_media_type: values.tmdbMediaType,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505" && values.tmdbId) {
      return actionError("Este conteúdo do TMDB já foi indicado neste grupo.");
    }
    return actionError("Não foi possível cadastrar o conteúdo. Verifique seu acesso ao grupo.");
  }

  revalidatePath(`/app/groups/${groupId.data}`);
  redirect(`/app/groups/${groupId.data}/contents/${data.id}`);
}

export async function updateContent(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const contentId = uuidSchema.safeParse(formString(formData, "contentId"));
  const parsed = parseContentForm(formData);
  if (!contentId.success || !parsed.success) {
    return actionError(
      "Revise os dados do conteúdo.",
      parsed.success ? undefined : parsed.error,
    );
  }

  const trailerId = normalizeYouTubeVideoId(parsed.data.trailerUrl);
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
    return actionError("Não foi possível registrar a avaliação.");
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
  const parsed = deleteMessageSchema.safeParse({
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
