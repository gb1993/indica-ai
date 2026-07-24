export default function ContentDetailsLoading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse px-5 py-12" aria-label="Carregando conteúdo e conversa">
      <div className="h-5 w-40 rounded bg-(--surface-muted)" />
      <div className="mt-6 h-96 rounded-2xl border bg-(--surface)" />
      <div className="mt-8 h-72 rounded-2xl border bg-(--surface)" />
    </main>
  );
}
