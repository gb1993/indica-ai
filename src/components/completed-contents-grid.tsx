"use client";

import { useState } from "react";

import { ContentCard, type ContentCardData } from "./content-card";

const PAGE_SIZE = 12;

export function CompletedContentsGrid({
  contents,
  eagerContentId,
}: {
  contents: ContentCardData[];
  eagerContentId?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleContents = contents.slice(0, visibleCount);
  const remainingCount = Math.max(contents.length - visibleContents.length, 0);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleContents.map((content) => (
          <ContentCard
            key={content.id}
            content={content}
            eager={content.id === eagerContentId}
          />
        ))}
      </div>
      {remainingCount ? (
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            className="app-button-secondary min-w-44"
          >
            Carregar mais
            <span className="text-xs text-(--muted)">({remainingCount})</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
