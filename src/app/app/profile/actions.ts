"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import {
  deleteAvatar,
  persistAvatar,
  validateOptimizedAvatar,
} from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import {
  actionError,
  formString,
  profileNameSchema,
} from "@/lib/validation";

export async function updateProfileName(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileNameSchema.safeParse({
    name: formString(formData, "name"),
  });
  if (!parsed.success) {
    return actionError("Revise o nome informado.", parsed.error);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return actionError("Sua sessão expirou. Entre novamente.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name })
    .eq("id", authData.user.id)
    .select("id")
    .single();

  if (error || !profile) {
    return actionError("Não foi possível atualizar seu nome.");
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");
  return { status: "success", message: "Nome atualizado." };
}

type AvatarActionState = {
  status: "success" | "error";
  message: string;
  avatarUrl?: string;
};

function revalidateProfile() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");
}

export async function saveProfileAvatar(formData: FormData): Promise<AvatarActionState> {
  const image = formData.get("avatar");
  if (!(image instanceof File)) {
    return { status: "error", message: "Selecione e recorte uma imagem novamente." };
  }

  const validationError = validateOptimizedAvatar(image);
  if (validationError) return { status: "error", message: validationError };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { status: "error", message: "Sua sessão expirou. Entre novamente." };
  }

  const userId = authData.user.id;
  try {
    const avatarUrl = await persistAvatar({
      userId,
      optimizedImage: image,
      dependencies: {
        authenticate: async () => userId,
        uploadObject: async (path, blob) => {
          const { error } = await supabase.storage.from("avatars").upload(path, blob, {
            cacheControl: "3600",
            contentType: "image/webp",
            upsert: true,
          });
          if (error) throw error;
        },
        getPublicUrl: (path) =>
          supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl,
        updateProfile: async (url) => {
          const { data, error } = await supabase
            .from("profiles")
            .update({ avatar_url: url })
            .eq("id", userId)
            .select("id")
            .single();
          if (error || !data) throw error ?? new Error("Profile update failed");
        },
        removeObject: async (path) => {
          const { error } = await supabase.storage.from("avatars").remove([path]);
          if (error) throw error;
        },
      },
    });

    revalidateProfile();
    return {
      status: "success",
      message: "Foto de perfil atualizada.",
      avatarUrl,
    };
  } catch {
    console.error("Profile avatar upload failed");
    return { status: "error", message: "Não foi possível atualizar a foto." };
  }
}

export async function removeProfileAvatar(): Promise<AvatarActionState> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { status: "error", message: "Sua sessão expirou. Entre novamente." };
  }

  const userId = authData.user.id;
  try {
    await deleteAvatar({
      userId,
      dependencies: {
        authenticate: async () => userId,
        removeObject: async (path) => {
          const { error } = await supabase.storage.from("avatars").remove([path]);
          if (error) throw error;
        },
        updateProfile: async (url) => {
          const { data, error } = await supabase
            .from("profiles")
            .update({ avatar_url: url })
            .eq("id", userId)
            .select("id")
            .single();
          if (error || !data) throw error ?? new Error("Profile update failed");
        },
      },
    });

    revalidateProfile();
    return { status: "success", message: "Foto de perfil removida." };
  } catch {
    console.error("Profile avatar removal failed");
    return { status: "error", message: "Não foi possível remover a foto." };
  }
}
