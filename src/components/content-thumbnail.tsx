"use client";

import Image from "next/image";
import { useState } from "react";

const fallbackColors = [
  "#166534",
  "#1d4ed8",
  "#7e22ce",
  "#be123c",
  "#b45309",
  "#0f766e",
  "#4338ca",
  "#9f1239",
];

function fallbackColor(title: string) {
  const hash = Array.from(title).reduce(
    (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );
  return fallbackColors[hash % fallbackColors.length];
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
        className="absolute inset-0 grid place-items-center p-8 text-center text-white"
        style={{ backgroundColor: fallbackColor(title) }}
      >
        <span className="line-clamp-4 text-2xl font-black tracking-tight sm:text-3xl">{title}</span>
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
