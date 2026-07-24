"use client";

import Image from "next/image";
import { useState } from "react";

const fallbackGradients = [
  "radial-gradient(circle at 75% 20%, #7650b8 0, transparent 32%), linear-gradient(145deg, #101523, #242a3d)",
  "radial-gradient(circle at 25% 25%, #bf6a35 0, transparent 32%), linear-gradient(145deg, #17101f, #43324b)",
  "radial-gradient(circle at 70% 72%, #266a7a 0, transparent 35%), linear-gradient(145deg, #080e19, #182b3a)",
  "radial-gradient(circle at 30% 75%, #7c2d58 0, transparent 34%), linear-gradient(145deg, #17101c, #382038)",
  "radial-gradient(circle at 70% 22%, #816229 0, transparent 35%), linear-gradient(145deg, #11141d, #34313a)",
  "radial-gradient(circle at 30% 25%, #315cab 0, transparent 35%), linear-gradient(145deg, #0b1020, #242246)",
  "radial-gradient(circle at 65% 65%, #4f3795 0, transparent 34%), linear-gradient(145deg, #0c101a, #25203d)",
  "radial-gradient(circle at 35% 65%, #75504b 0, transparent 34%), linear-gradient(145deg, #111217, #35282a)",
];

function fallbackGradient(title: string) {
  const hash = Array.from(title).reduce(
    (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );
  return fallbackGradients[hash % fallbackGradients.length];
}

export function ContentThumbnail({
  src,
  alt,
  title,
  eager = false,
  className = "object-cover",
}: {
  src: string | null;
  alt: string;
  title: string;
  eager?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="absolute inset-0 grid place-items-center overflow-hidden p-7 text-center text-white after:absolute after:inset-0 after:bg-[linear-gradient(180deg,transparent_42%,rgba(0,0,0,.55))]"
        style={{ background: fallbackGradient(title) }}
      >
        <span className="relative z-1 line-clamp-4 text-xl font-black tracking-tight drop-shadow-lg sm:text-2xl">{title}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      loading={eager ? "eager" : "lazy"}
      sizes="(max-width: 640px) 100vw, 320px"
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
