import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";

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
  title: { default: "Indica Aí", template: "%s | Indica Aí" },
  description: "Indique, avalie e compartilhe conteúdos com seus amigos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
