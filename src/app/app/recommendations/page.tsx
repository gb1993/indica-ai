import type { Metadata } from "next";
import Link from "next/link";

import { RecommendationCard } from "@/components/recommendation-card";
import { createClient } from "@/lib/supabase/server";
import { getTmdbRecommendations } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Descobrir" };

type Membership = {
  group: { id: string; name: string } | null;
};

export default async function RecommendationsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [{ data: membershipRows }, sections] = await Promise.all([
    supabase
      .from("group_members")
      .select("group:groups(id, name)")
      .eq("user_id", authData.user!.id)
      .eq("status", "active")
      .order("joined_at", { ascending: false }),
    getTmdbRecommendations(),
  ]);
  const groups = ((membershipRows ?? []) as unknown as Membership[])
    .flatMap(({ group }) => group ? [group] : []);
  const allUnavailable = sections.every((section) => section.unavailable);

  return (
    <main id="main-content" className="app-page">
      <header className="relative mb-10 overflow-hidden rounded-3xl border bg-[linear-gradient(120deg,color-mix(in_srgb,var(--accent)_22%,var(--surface)),var(--surface)_58%,color-mix(in_srgb,var(--gold)_10%,var(--surface)))] px-6 py-9 shadow-xl shadow-violet-950/10 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-(--accent)/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-(--accent-strong)">
            Recomendações em destaque
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
            Descubra sua próxima indicação
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-(--muted) sm:text-base">
            Explore o que está em alta no cinema e envie um título diretamente
            para o grupo com quem você quer assistir.
          </p>
          {!groups.length ? (
            <Link href="/app/groups/new" className="app-button-primary mt-6">
              Criar um grupo
            </Link>
          ) : null}
        </div>
      </header>

      {allUnavailable ? (
        <section className="app-panel p-8 text-center">
          <h2 className="text-lg font-bold">Recomendações indisponíveis</h2>
          <p className="mt-2 text-sm text-(--muted)">
            Não foi possível consultar o TMDB agora. Tente novamente em instantes.
          </p>
        </section>
      ) : (
        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`${section.id}-title`}>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 id={`${section.id}-title`} className="text-2xl font-black tracking-tight">
                    {section.title}
                  </h2>
                  <p className="mt-1 text-sm text-(--muted)">{section.description}</p>
                </div>
                {!section.unavailable ? (
                  <span className="shrink-0 text-xs text-(--muted)">
                    {section.items.length} títulos
                  </span>
                ) : null}
              </div>

              {section.unavailable ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-(--muted)">
                  Esta seleção não pôde ser carregada agora.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {section.items.map((item) => (
                    <RecommendationCard
                      key={`${section.id}-${item.mediaType}-${item.tmdbId}`}
                      item={item}
                      groups={groups}
                      sectionId={section.id}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 border-t pt-5 text-xs text-(--muted)">
        Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
      </p>
    </main>
  );
}
