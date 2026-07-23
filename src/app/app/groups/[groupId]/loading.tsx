import { Skeleton } from "@/components/skeleton";

export default function GroupLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:py-12" aria-label="Carregando grupo">
      <Skeleton className="h-5 w-52" />
      <Skeleton className="mt-6 h-52" />
      <Skeleton className="mt-6 h-12" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-72" />)}
      </div>
    </main>
  );
}
