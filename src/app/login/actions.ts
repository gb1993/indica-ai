"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type RequestCodeState = {
  status: "idle" | "sent" | "error";
  message: string;
  email?: string;
};

export type VerifyCodeState = {
  status: "idle" | "error";
  message: string;
};

const emailSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  z.email("Informe um e-mail válido.").max(254),
);

const requestCodeSchema = z.object({
  email: emailSchema,
});

const verifyCodeSchema = z.object({
  email: emailSchema,
  token: z.preprocess(
    (value) =>
      typeof value === "string" ? value.replace(/\s/g, "") : value,
    z
      .string()
      .regex(/^\d{6,10}$/, "Informe o código numérico recebido por e-mail."),
  ),
});

export async function requestEmailCode(
  _previousState: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  const result = requestCodeSchema.safeParse({ email: formData.get("email") });

  if (!result.success) {
    return { status: "error", message: result.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: result.data.email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("Email OTP request failed", { code: error.code });
    return {
      status: "error",
      message: "Não foi possível enviar o código agora. Aguarde um instante e tente novamente.",
    };
  }

  // Deliberately generic to avoid revealing whether an address already exists.
  return {
    status: "sent",
    email: result.data.email,
    message: "Enviamos um código de acesso para o e-mail informado.",
  };
}

export async function verifyEmailCode(
  _previousState: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const result = verifyCodeSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });

  if (!result.success) {
    return { status: "error", message: result.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: result.data.email,
    token: result.data.token,
    type: "email",
  });

  if (error) {
    console.error("Email OTP verification failed", { code: error.code });
    return {
      status: "error",
      message: "Código inválido ou expirado. Confira o código e tente novamente.",
    };
  }

  redirect("/app");
}
