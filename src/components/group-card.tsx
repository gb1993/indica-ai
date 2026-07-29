import Link from "next/link";

import { LocalDateTime } from "./local-date-time";

export type GroupCardData = {
  id: string;
  name: string;
  description: string | null;
  role: "owner" | "member";
  memberCount: number;
  availableCount: number;
  completedCount: number;
  lastActivity: { label: string; createdAt: string } | null;
};

export function GroupCard({ group }: { group: GroupCardData }) {
  return (
    <Link href={`/app/groups/${group.id}`} className="app-panel group relative flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-1 hover:border-(--accent) motion-reduce:hover:translate-y-0 sm:p-6">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,var(--accent),transparent_72%)] opacity-70" />
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold group-hover:text-(--accent-strong)">{group.name}</h2>
        <span className="shrink-0 rounded-full border bg-(--accent-soft) px-2.5 py-1 text-[0.68rem] text-(--accent-strong)">{group.role === "owner" ? "Proprietário" : "Membro"}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-(--muted)">{group.description || "Sem descrição."}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl border bg-(--surface-muted) py-3 text-center">
        <div><dt className="text-[0.68rem] text-(--muted)">Membros</dt><dd className="mt-1 font-bold">{group.memberCount}</dd></div>
        <div><dt className="text-[0.68rem] text-(--muted)">Disponíveis</dt><dd className="mt-1 font-bold">{group.availableCount}</dd></div>
        <div><dt className="text-[0.68rem] text-(--muted)">Concluídos</dt><dd className="mt-1 font-bold">{group.completedCount}</dd></div>
      </dl>
      <div className="mt-4 text-xs text-(--muted)">
        <p className="font-semibold text-(--foreground)">Última atividade</p>
        {group.lastActivity ? (
          <p className="mt-1 line-clamp-2">
            {group.lastActivity.label} ·{" "}
            <LocalDateTime
              value={group.lastActivity.createdAt}
              dateStyle="short"
              timeStyle="short"
            />
          </p>
        ) : <p className="mt-1">Nenhuma atividade registrada.</p>}
      </div>
    </Link>
  );
}
