"use client";

export default function ContentDetailsError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-5 py-12">
      <section className="max-w-md rounded-3xl border bg-[var(--surface)] p-8 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar o conteúdo</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Tente novamente. Se o erro continuar, volte ao grupo.</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#07150c]">Tentar novamente</button>
      </section>
    </main>
  );
}
