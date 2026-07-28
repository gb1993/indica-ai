import { Skeleton } from "@/components/skeleton";

export default function RecommendationsLoading() {
  return (
    <main id="main-content" className="app-page">
      <Skeleton className="mb-10 h-72 rounded-3xl" />
      {[0, 1, 2].map((section) => (
        <section key={section} className="mb-12">
          <Skeleton className="mb-3 h-8 w-48" />
          <Skeleton className="mb-5 h-4 w-72 max-w-full" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <Skeleton key={card} className="aspect-2/3 rounded-2xl" />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
