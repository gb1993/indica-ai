import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/action-form";

import { createGroup } from "../actions";

export const metadata: Metadata = { title: "Novo grupo" };

export default function NewGroupPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Voltar aos grupos</Link>
      <section className="mt-6 rounded-3xl border bg-[var(--surface)] p-7 sm:p-9">
        <h1 className="text-3xl font-bold tracking-tight">Criar grupo</h1>
        <p className="mt-2 text-[var(--muted)]">Você será o proprietário e poderá convidar os demais membros.</p>
        <ActionForm
          action={createGroup}
          submitLabel="Criar grupo"
          pendingLabel="Criando…"
          className="mt-7 space-y-5"
          buttonClassName="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#07150c] transition disabled:opacity-60"
        >
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">Nome</label>
            <input id="name" name="name" required minLength={2} maxLength={80} className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3" placeholder="Clube do sofá" />
          </div>
          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium">Descrição <span className="text-[var(--muted)]">(opcional)</span></label>
            <textarea id="description" name="description" maxLength={500} rows={4} className="w-full resize-y rounded-xl border bg-[var(--surface-muted)] px-4 py-3" placeholder="O que une este grupo?" />
          </div>
        </ActionForm>
      </section>
    </main>
  );
}
