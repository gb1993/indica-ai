"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
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
