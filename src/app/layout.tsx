import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const themeBootScript = `
  try {
    document.documentElement.classList.toggle(
      "dark",
      localStorage.getItem("indica-ai-theme") !== "light"
    );
  } catch {}
`;

export const metadata: Metadata = {
  title: {
    default: "Indica Aí",
    template: "%s | Indica Aí",
  },
  description: "Indique, avalie e compartilhe filmes, séries, animes, documentários e muito mais com seus amigos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>

        {children}

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
