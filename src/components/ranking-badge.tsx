import Image from "next/image";

const rankingImages = {
  1: "/ranking/trophy.webp",
  2: "/ranking/silver-medal.webp",
  3: "/ranking/bronze-medal.webp",
} as const;

export function RankingBadge({
  position,
  label = `${position}º lugar`,
}: {
  position: number;
  label?: string;
}) {
  const image = rankingImages[position as keyof typeof rankingImages];

  if (!image) {
    return (
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-(--surface-muted) text-xs font-black text-(--muted)"
        aria-label={label}
      >
        {position}
      </span>
    );
  }

  return (
    <span
      className="relative inline-block size-8 shrink-0"
      title={label}
      aria-label={label}
    >
      <Image
        src={image}
        alt=""
        fill
        sizes="32px"
        className="object-contain drop-shadow-sm"
      />
    </span>
  );
}
