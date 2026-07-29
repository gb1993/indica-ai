"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/app/dashboard/theme-toggle";

import { AppIcon, type AppIconName } from "./app-icon";

type SidebarGroup = {
  id: string;
  name: string;
  role: "owner" | "member";
};

type AppSidebarProps = {
  groups: SidebarGroup[];
  profile: {
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  logoutAction: () => Promise<void>;
};

const primaryLinks: Array<{ href: string; label: string; icon: AppIconName; isNew?: boolean }> = [
  { href: "/dashboard", label: "Início", icon: "home" },
  { href: "/app/recommendations", label: "Descobrir", icon: "discover", isNew: true },
  { href: "/app/profile", label: "Perfil", icon: "user" },
  { href: "/app/groups/new", label: "Criar grupo", icon: "plus" },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className={`flex items-center gap-3 ${compact ? "" : "h-[4.55rem] border-b px-5"}`}>
      <span className={`grid place-items-center rounded-xl bg-[linear-gradient(145deg,#f7c94b,#8b5cf6)] text-white shadow-lg shadow-violet-950/25 ${compact ? "size-8" : "size-9"}`}>
        <AppIcon name="clapper" className="size-5" />
      </span>
      <span className={`bg-[linear-gradient(90deg,#ddd6fe,#a78bfa)] bg-clip-text font-black tracking-[0.08em] text-transparent ${compact ? "text-base" : "text-lg"}`}>
        INDICA AÍ
      </span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  isNew,
}: {
  href: string;
  label: string;
  icon: AppIconName;
  active: boolean;
  isNew?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${
        active
          ? "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--accent)_25%,transparent),color-mix(in_srgb,var(--accent)_9%,transparent))] font-semibold text-(--foreground) ring-1 ring-inset ring-(--accent)/25"
          : "text-(--muted) hover:bg-(--surface-muted) hover:text-(--foreground)"
      }`}
    >
      <AppIcon name={icon} className={`size-[1.1rem] ${active ? "text-(--accent-strong)" : ""}`} />
      <span className="truncate">{label}</span>
      {isNew ? (
        <span className="new-feature-badge ml-auto" aria-label="Novo recurso">
          NEW
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  groups,
  profile,
  logoutAction,
}: AppSidebarProps) {
  const pathname = usePathname();
  const initial = profile.name.trim().charAt(0).toUpperCase() || "U";

  return (
    <>
      <Brand />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5">
        <nav aria-label="Navegação principal" className="space-y-1">
          {primaryLinks.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={
                item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
              }
            />
          ))}
        </nav>

        <div className="my-5 border-t" />
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-(--muted)">
            Meus grupos
          </p>
          <span className="text-xs text-(--muted)">{groups.length}</span>
        </div>
        <nav aria-label="Meus grupos" className="space-y-1">
          {groups.map((group) => {
            const href = `/app/groups/${group.id}`;
            return (
              <NavLink
                key={group.id}
                href={href}
                label={group.name}
                icon="clapper"
                active={pathname.startsWith(href)}
              />
            );
          })}
          {!groups.length ? (
            <p className="px-3 py-2 text-xs leading-relaxed text-(--muted)">
              Seus grupos aparecerão aqui.
            </p>
          ) : null}
        </nav>
      </div>

      <div className="space-y-3 border-t p-3">
        <div className="flex items-center gap-3 rounded-xl border bg-(--surface) p-2.5">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={`Avatar de ${profile.name}`}
              width={38}
              height={38}
              className="size-9.5 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <span className="grid size-9.5 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#6d28d9,#c084fc)] text-sm font-bold text-white">
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{profile.name}</span>
            <span className="block truncate text-[0.68rem] text-(--muted)">{profile.email}</span>
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sair"
              title="Sair"
              className="grid size-8 place-items-center rounded-lg text-(--muted) hover:bg-(--surface-muted) hover:text-(--foreground)"
            >
              <AppIcon name="logout" className="size-4" />
            </button>
          </form>
        </div>
        <ThemeToggle showLabel />
      </div>
    </>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-[color-mix(in_srgb,var(--background)_94%,transparent)] backdrop-blur-xl lg:flex">
        <SidebarContent {...props} />
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 backdrop-blur-xl lg:hidden">
        <Brand compact />
        <details className="group relative">
          <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border bg-(--surface)">
            <span className="sr-only">Abrir navegação</span>
            <AppIcon name="menu" className="size-5" />
          </summary>
          <div className="fixed inset-x-3 top-18 flex max-h-[calc(100vh-5.25rem)] flex-col overflow-hidden rounded-2xl border bg-(--background) shadow-2xl shadow-black/40">
            <SidebarContent {...props} />
          </div>
        </details>
      </header>
    </>
  );
}
