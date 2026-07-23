import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

const themeBootScript = `
  (function () {
    try {
      var savedTheme = localStorage.getItem('indica-ai-theme');
      var isDark = savedTheme !== 'light';
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    } catch (_) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  })();
`;

export const metadata: Metadata = {
  title: { default: "Indica Aí", template: "%s | Indica Aí" },
  description: "Escolha, vote e compartilhe conteúdos com seus amigos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
