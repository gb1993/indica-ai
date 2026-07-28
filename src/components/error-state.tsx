"use client";

import { AppIcon } from "./app-icon";

export function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <section className="app-panel max-w-md p-8 text-center">
      <AppIcon name="warning" className="mx-auto size-8 text-amber-500" />
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-(--muted)">{description}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="app-button-primary mt-6">Tentar novamente</button> : null}
    </section>
  );
}
