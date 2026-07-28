export type ActivityRank = 1 | 2 | 3;

export function MostActiveBadge({ position = 1 }: { position?: ActivityRank }) {
  const styles: Record<ActivityRank, string> = {
    1: "border-amber-300/80 bg-[linear-gradient(145deg,#fff3b0,#eaa90d)] text-[#5b3a00] shadow-amber-500/30",
    2: "border-slate-200/80 bg-[linear-gradient(145deg,#ffffff,#9da8ba)] text-[#344054] shadow-slate-400/30",
    3: "border-orange-300/80 bg-[linear-gradient(145deg,#ffd09a,#a45a20)] text-[#4a2100] shadow-orange-500/30",
  };

  return (
    <span
      className={`relative inline-grid size-8 shrink-0 place-items-center rounded-full border shadow-md ${styles[position]}`}
      title={`${position}º membro com mais interações neste grupo`}
      aria-label={`${position}º lugar entre os membros mais ativos`}
    >
      {position === 1 ? (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4.5"
          fill="currentColor"
        >
          <path d="M7 3h10v3h3v2.2c0 3-1.9 5.2-4.7 5.7A5.1 5.1 0 0 1 13 16.8V19h3v2H8v-2h3v-2.2A5.1 5.1 0 0 1 8.7 14C5.9 13.4 4 11.2 4 8.2V6h3V3Zm0 5H6v.2c0 1.7.8 3 2.1 3.6A8 8 0 0 1 7 8Zm10 0a8 8 0 0 1-1.1 3.8C17.2 11.2 18 9.9 18 8.2V8h-1Z" />
        </svg>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="currentColor"
          >
            <path d="m6 2 3.4 7.1A6 6 0 1 0 14.6 9L18 2h-4l-2 4.2L10 2H6Zm6 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
          </svg>
          <span aria-hidden className="absolute bottom-[0.34rem] text-[0.48rem] font-black leading-none">
            {position}
          </span>
        </>
      )}
    </span>
  );
}
