import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-dashed bg-[var(--surface)] p-8 text-center sm:p-10">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
