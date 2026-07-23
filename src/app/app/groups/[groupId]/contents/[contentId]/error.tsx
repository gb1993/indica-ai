"use client";

import { ErrorState } from "@/components/error-state";

export default function ContentDetailsError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-5 py-12">
      <ErrorState title="Não foi possível carregar o conteúdo" description="Tente novamente. Se o erro continuar, volte ao grupo." onRetry={reset} />
    </main>
  );
}
