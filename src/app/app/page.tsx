import type { Metadata } from "next";

export const metadata: Metadata = { title: "Início" };

export default function AppPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <section className="rounded-3xl border bg-[var(--surface)] p-7 sm:p-10">
        <p className="mb-3 text-sm font-semibold text-[var(--accent-strong)]">Seu espaço privado</p>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Boas indicações começam com boas companhias.</h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">Sua conta está pronta. Na próxima etapa, seus grupos e convites aparecerão aqui.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Indique", "Filmes, séries, animes, documentários e livros."],
            ["Vote", "O grupo decide junto o que entra na lista."],
            ["Converse", "Cada conteúdo ganha uma conversa privada."],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl bg-[var(--surface-muted)] p-5">
              <h2 className="font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
