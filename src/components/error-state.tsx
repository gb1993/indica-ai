"use client";

export function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <section className="max-w-md rounded-3xl border bg-(--surface) p-8 text-center">
      <span aria-hidden className="text-3xl">⚠</span>
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-(--muted)">{description}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c]">Tentar novamente</button> : null}
    </section>
  );
}
