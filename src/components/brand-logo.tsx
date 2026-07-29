import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
};

export function BrandLogo({
  size = 48,
  className = "",
  priority = false,
  decorative = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand-logo.webp"
      alt={decorative ? "" : "Indica Aí"}
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-[24%] object-cover shadow-lg shadow-violet-950/25 ${className}`}
    />
  );
}
