import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

import { logout } from "./actions";

type Membership = {
  role: "owner" | "member";
  group: { id: string; name: string } | null;
};

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const [{ data: profile }, { data: membershipRows }] = await Promise.all([
    supabase.from("profiles").select("name, email, avatar_url").eq("id", authData.user.id).single(),
    supabase
      .from("group_members")
      .select("role, group:groups(id, name)")
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .order("joined_at", { ascending: false }),
  ]);
  const name = profile?.name ?? authData.user.email?.split("@")[0] ?? "Usuário";
  const email = profile?.email ?? authData.user.email ?? "";
  const groups = ((membershipRows ?? []) as unknown as Membership[]).flatMap(
    ({ group, role }) => (group ? [{ ...group, role }] : []),
  );

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="fixed left-3 top-3 z-100 -translate-y-24 rounded-lg bg-(--accent) px-4 py-2 font-bold text-white focus:translate-y-0">
        Pular para o conteúdo
      </a>
      <AppSidebar
        groups={groups}
        profile={{ name, email, avatarUrl: profile?.avatar_url ?? null }}
        logoutAction={logout}
      />
      <div className="lg:pl-60">{children}</div>
    </div>
  );
}
