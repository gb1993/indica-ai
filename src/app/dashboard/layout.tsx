import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { getDashboardContext } from "@/lib/dashboard";

import { logout } from "./actions";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, profile, groups: dashboardGroups } = await getDashboardContext();
  if (!user) redirect("/");

  const name = profile?.name ?? user.email?.split("@")[0] ?? "Usuário";
  const email = profile?.email ?? user.email ?? "";
  const groups = dashboardGroups.map((group) => ({
    id: group.group_id,
    name: group.name,
    role: group.role,
  }));

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
