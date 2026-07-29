import Image from "next/image";

const rankingImages = {
  1: "/ranking/trophy.webp",
  2: "/ranking/silver-medal.webp",
  3: "/ranking/bronze-medal.webp",
} as const;

export function RankingBadge({
  position,
  label = `${position}º lugar`,
  size = 24,
}: {
  position: number;
  label?: string;
  size?: 24 | 32;
}) {
  const image = rankingImages[position as keyof typeof rankingImages];
  const sizeClass = size === 32 ? "size-8" : "size-6";

  if (!image) {
    return (
      <span
        className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-(--surface-muted) text-xs font-black text-(--muted)`}
        aria-label={label}
      >
        {position}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-block ${sizeClass} shrink-0`}
      title={label}
      aria-label={label}
    >
      <Image
        src={image}
        alt={`icone ${label}`}
        fill
        sizes={`${size}px`}
        className="object-contain drop-shadow-sm"
      />
    </span>
  );
}
