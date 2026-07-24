import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AvatarForm } from "@/components/avatar-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProfileNameForm } from "@/components/profile-name-form";
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
          name={profile.name}
          initialAvatarUrl={profile.avatar_url}
        />
      </section>

      <section className="app-panel mt-5 p-6 sm:p-8">
        <h2 className="font-bold">Dados da conta</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <ProfileNameForm initialName={profile.name} />
          <div>
            <p className="text-sm font-medium">E-mail</p>
            <p className="mt-2 break-all font-medium">{profile.email}</p>
            <p className="mt-1.5 text-xs text-(--muted)">
              O e-mail é gerenciado pela sua conta de acesso.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
