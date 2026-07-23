import Link from "next/link";

export type GroupCardData = {
  id: string;
  name: string;
  description: string | null;
  role: "owner" | "member";
  memberCount: number;
  pendingCount: number;
  approvedCount: number;
  lastActivity: { label: string; createdAt: string } | null;
};

export function GroupCard({ group }: { group: GroupCardData }) {
  return (
    <Link href={`/app/groups/${group.id}`} className="group flex h-full flex-col rounded-2xl border bg-(--surface) p-5 transition hover:-translate-y-0.5 hover:border-(--accent) motion-reduce:hover:translate-y-0 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold group-hover:text-(--accent-strong)">{group.name}</h2>
        <span className="shrink-0 rounded-full bg-(--surface-muted) px-2.5 py-1 text-xs text-(--muted)">{group.role === "owner" ? "Proprietário" : "Membro"}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-(--muted)">{group.description || "Sem descrição."}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2 border-y py-4 text-center">
        <div><dt className="text-[0.68rem] text-(--muted)">Membros</dt><dd className="mt-1 font-bold">{group.memberCount}</dd></div>
        <div><dt className="text-[0.68rem] text-(--muted)">Pendentes</dt><dd className="mt-1 font-bold">{group.pendingCount}</dd></div>
        <div><dt className="text-[0.68rem] text-(--muted)">Próximos</dt><dd className="mt-1 font-bold">{group.approvedCount}</dd></div>
      </dl>
      <div className="mt-4 text-xs text-(--muted)">
        <p className="font-semibold text-(--foreground)">Última atividade</p>
        {group.lastActivity ? (
          <p className="mt-1 line-clamp-2">{group.lastActivity.label} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(group.lastActivity.createdAt))}</p>
        ) : <p className="mt-1">Nenhuma atividade registrada.</p>}
      </div>
    </Link>
  );
}
