import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AvatarForm } from "@/components/avatar-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, avatar_url")
    .eq("id", authData.user.id)
    .single();
  if (!profile) notFound();

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-5 py-8 sm:px-7 sm:py-10">
      <Breadcrumbs items={[{ label: "Início", href: "/dashboard" }, { label: "Perfil" }]} />
      <header className="mt-5">
        <h1 className="text-3xl font-bold tracking-tight">Seu perfil</h1>
        <p className="mt-2 text-sm text-(--muted)">
          Personalize como você aparece para os membros dos seus grupos.
        </p>
      </header>

      <section className="app-panel mt-7 p-6 sm:p-8">
        <AvatarForm
          userId={authData.user.id}
          name={profile.name}
          initialAvatarUrl={profile.avatar_url}
        />
      </section>

      <section className="app-panel mt-5 p-6 sm:p-8">
        <h2 className="font-bold">Dados da conta</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-(--muted)">Nome</dt>
            <dd className="mt-1 font-medium">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-(--muted)">E-mail</dt>
            <dd className="mt-1 break-all font-medium">{profile.email}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
