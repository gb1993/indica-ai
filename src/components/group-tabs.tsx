import Link from "next/link";

export type GroupTab = "overview" | "pending" | "approved" | "completed" | "members" | "activities";

const tabs: Array<{ id: GroupTab; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "pending", label: "Aguardando aprovação" },
  { id: "approved", label: "Próximos" },
  { id: "completed", label: "Concluídos" },
  { id: "members", label: "Membros" },
  { id: "activities", label: "Atividades" },
];

function tabHref(groupId: string, tab: GroupTab) {
  if (tab === "overview") return `/app/groups/${groupId}`;
  if (tab === "members") return `/app/groups/${groupId}/members`;
  if (tab === "activities") return `/app/groups/${groupId}/activities`;
  return `/app/groups/${groupId}?tab=${tab}`;
}

export function GroupTabs({ groupId, active }: { groupId: string; active: GroupTab }) {
  return (
    <nav aria-label="Seções do grupo" className="mt-6 overflow-x-auto border-b">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tabHref(groupId, tab.id)}
              aria-current={active === tab.id ? "page" : undefined}
              className={`block border-b-2 px-3 py-3 text-sm font-semibold transition ${
                active === tab.id
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
