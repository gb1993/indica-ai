import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

import { EmailCodeForm } from "./login/email-code-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/invite/") && !next.startsWith("//")
    ? next
    : "/dashboard";
  if (data.user) redirect(nextPath);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <span aria-hidden className="absolute -left-24 top-1/4 size-72 rounded-full bg-violet-600/10 blur-3xl" />
      <span aria-hidden className="absolute -right-24 bottom-1/4 size-80 rounded-full bg-fuchsia-600/8 blur-3xl" />
      <section className="app-auth-panel relative w-full max-w-md p-7 sm:p-9">
        <div className="mb-8">
          <BrandLogo size={56} className="mb-5" priority />
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-strong)">Seu clube privado</p>
          <h1 className="text-3xl font-bold tracking-tight">Indica Aí</h1>
          <p className="mt-2 text-(--muted)">
            O lugar privado do seu grupo para escolher o que vem a seguir.
          </p>
        </div>

        <EmailCodeForm nextPath={nextPath} />
      </section>
    </main>
  );
}
