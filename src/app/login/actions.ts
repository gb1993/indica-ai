"use server";

import { z } from "zod";

import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = { status: "idle" | "success" | "error"; message: string };

const magicLinkSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(254),
});

export async function requestMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const result = magicLinkSchema.safeParse({ email: formData.get("email") });

  if (!result.success) {
    return { status: "error", message: result.error.issues[0].message };
  }

  const supabase = await createClient();
  const env = getPublicEnv();
  await supabase.auth.signInWithOtp({
    email: result.data.email,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/app`,
      shouldCreateUser: true,
    },
  });

  // Deliberately generic to avoid revealing whether an address already exists.
  return {
    status: "success",
    message: "Se o endereço puder receber o acesso, enviaremos um link em instantes.",
  };
}
