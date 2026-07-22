import type { Metadata } from "next";
import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Indica Aí", template: "%s | Indica Aí" },
  description: "Escolha, vote e compartilhe conteúdos com seus amigos.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let theme: "dark" | "light" = "dark";

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.theme === "light") theme = "light";
    }
  } catch {
    // Keep the safe dark default while the project is not configured yet.
  }

  return (
    <html lang="pt-BR" className={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
