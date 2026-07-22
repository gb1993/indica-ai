import { Resend } from "resend";
import { z } from "zod";

const resendEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),
});

export function createResendClient() {
  const config = resendEnvSchema.parse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  });

  return {
    client: new Resend(config.RESEND_API_KEY),
    from: `Indica Aí <${config.RESEND_FROM_EMAIL}>`,
  };
}
