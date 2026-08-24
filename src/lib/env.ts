import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_WEBRTC_STUN_URL: z
    .string()
    .startsWith("stun:")
    .default("stun:stun.cloudflare.com:3478"),
});

export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WEBRTC_STUN_URL:
      process.env.NEXT_PUBLIC_WEBRTC_STUN_URL,
  });

  if (!parsed.success) {
    throw new Error(
      "Variáveis de ambiente ausentes ou inválidas. Consulte o arquivo .env.example.",
    );
  }

  return parsed.data;
}
