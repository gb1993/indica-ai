import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { GroupForm } from "@/components/group-form";

export const metadata: Metadata = { title: "Novo grupo" };

export default function NewGroupPage() {
  return (
    <main id="main-content" className="app-page max-w-3xl">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: "Criar grupo" }]} />
      <section className="app-panel mt-6 p-7 sm:p-9">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--accent-strong)">Novo espaço</p>
        <h1 className="text-3xl font-bold tracking-tight">Criar grupo</h1>
        <p className="mt-2 text-sm text-(--muted)">Você será o proprietário e poderá convidar os demais membros.</p>
        <div className="mt-7"><GroupForm /></div>
      </section>
    </main>
  );
}
