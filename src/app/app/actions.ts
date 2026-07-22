"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const themeSchema = z.enum(["dark", "light"]);

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateTheme(formData: FormData) {
  const parsed = themeSchema.safeParse(formData.get("theme"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ theme: parsed.data })
    .eq("id", data.user.id);

  if (!error) revalidatePath("/", "layout");
}
