import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { GroupForm } from "@/components/group-form";

export const metadata: Metadata = { title: "Novo grupo" };

export default function NewGroupPage() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Breadcrumbs items={[{ label: "Grupos", href: "/dashboard" }, { label: "Criar grupo" }]} />
      <section className="mt-6 rounded-3xl border bg-[var(--surface)] p-7 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight">Criar grupo</h1>
        <p className="mt-2 text-[var(--muted)]">Você será o proprietário e poderá convidar os demais membros.</p>
        <div className="mt-7"><GroupForm /></div>
      </section>
    </main>
  );
}
