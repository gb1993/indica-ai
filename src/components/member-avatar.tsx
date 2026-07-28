import Image from "next/image";

export function MemberAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-9" : "size-10.5";
  const pixels = size === "sm" ? 36 : 42;

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={`Foto de ${name}`}
        width={pixels}
        height={pixels}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#6d28d9,#c084fc)] text-sm font-bold text-white`}
    >
      {(name || "M").trim().charAt(0).toUpperCase()}
    </span>
  );
}
