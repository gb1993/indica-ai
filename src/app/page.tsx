import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border bg-[var(--surface)] p-7 shadow-2xl shadow-black/15 sm:p-9">
        <div className="mb-8">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-black text-[#07150c]">
            AÍ
          </div>
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
