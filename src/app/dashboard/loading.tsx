import { Skeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:py-12" aria-label="Carregando grupos">
      <Skeleton className="h-10 max-w-sm" />
      <Skeleton className="mt-3 h-5 max-w-lg" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-64" />)}
      </div>
    </main>
  );
}
