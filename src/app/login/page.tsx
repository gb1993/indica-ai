import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { loginWithGoogle } from "./actions";
import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/app");

  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border bg-[var(--surface)] p-7 shadow-2xl shadow-black/15 sm:p-9">
        <div className="mb-8">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-black text-[#07150c]">
            AÍ
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Indica Aí</h1>
          <p className="mt-2 text-[var(--muted)]">
            O lugar privado do seu grupo para escolher o que vem a seguir.
          </p>
        </div>

        {error ? (
          <p role="alert" className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
            Não foi possível concluir o acesso. Tente novamente.
          </p>
        ) : null}

        <form action={loginWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[#07150c] transition hover:brightness-110"
          >
            <span aria-hidden="true" className="text-lg">G</span>
            Continuar com Google
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--border)]" />ou<span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <MagicLinkForm />
        <p className="mt-6 text-center text-xs leading-relaxed text-[var(--muted)]">
          O acesso é restrito aos seus grupos. Seus dados nunca ficam no armazenamento local do navegador.
        </p>
      </section>
    </main>
  );
}
