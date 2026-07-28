export type ActivityRank = 1 | 2 | 3;

export function MostActiveBadge({ position = 1 }: { position?: ActivityRank }) {
  const styles: Record<ActivityRank, string> = {
    1: "border-amber-300/80 bg-[linear-gradient(145deg,#ffe28a,#eaa90d)] text-[#3d2a00] shadow-amber-500/20",
    2: "border-slate-200/80 bg-[linear-gradient(145deg,#f8fafc,#9da8ba)] text-[#273244] shadow-slate-400/20",
    3: "border-orange-300/80 bg-[linear-gradient(145deg,#f2b66d,#a45a20)] text-[#321700] shadow-orange-500/20",
  };

  return (
    <span
      className={`inline-grid size-7 shrink-0 place-items-center rounded-full border text-xs font-black shadow-md ${styles[position]}`}
      title={`${position}º membro com mais interações neste grupo`}
      aria-label={`${position}º lugar entre os membros mais ativos`}
    >
      {position}º
    </span>
  );
}
