"use client";

import { useRef } from "react";

import { Carousel } from "./carousel";
import { AppIcon } from "./app-icon";
import { MemberAvatar } from "./member-avatar";
import { MostActiveBadge, type ActivityRank } from "./most-active-badge";

export type ContentReview = {
  id: string;
  rating: number;
  comment: string | null;
  updatedAt: string;
  memberName: string;
  avatarUrl: string | null;
  activityRank: ActivityRank | null;
};

function ReviewCard({ review }: { review: ContentReview }) {
  return (
    <article className="flex h-full min-h-44 flex-col rounded-2xl border bg-(--surface-muted) p-5">
      <p
        className="text-xl tracking-wider text-amber-500"
        aria-label={`${review.rating} de 5 estrelas`}
      >
        <span aria-hidden className="inline-flex gap-0.5">
          {Array.from({ length: 5 }, (_, index) => (
            <AppIcon
              key={index}
              name="star"
              className={`size-4.5 ${index < review.rating ? "" : "text-(--border)"}`}
              fill="currentColor"
            />
          ))}
        </span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <MemberAvatar name={review.memberName} avatarUrl={review.avatarUrl} size="sm" />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-bold">{review.memberName}</p>
          {review.activityRank ? <MostActiveBadge position={review.activityRank} /> : null}
        </div>
      </div>
      <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${review.comment ? "" : "italic text-(--muted)"}`}>
        {review.comment ?? "Sem comentário."}
      </p>
    </article>
  );
}

export function ContentReviews({ reviews }: { reviews: ContentReview[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  if (!reviews.length) {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-(--muted)">
        Nenhuma avaliação ainda. Seja a primeira pessoa a avaliar.
      </p>
    );
  }

  return (
    <>
      <Carousel
        ariaLabel="Destaques das avaliações"
        slideClassName="basis-full md:basis-1/3"
        loop
        autoplay
      >
        {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      </Carousel>

      <div className="mt-5 flex justify-center">
        <button
          ref={openButtonRef}
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="rounded-xl border bg-(--surface) px-5 py-2.5 text-sm font-bold hover:bg-(--surface-muted)"
        >
          Ver todas as avaliações
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="all-reviews-title"
        onClose={() => openButtonRef.current?.focus()}
        className="m-auto max-h-[85vh] w-[min(92vw,44rem)] rounded-2xl border bg-(--surface) p-0 text-(--foreground) shadow-2xl backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-(--surface) p-5 sm:px-7">
          <div>
            <h2 id="all-reviews-title" className="text-xl font-bold">Todas as avaliações</h2>
            <p className="mt-1 text-sm text-(--muted)">
              {reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"} de membros do grupo
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar avaliações"
            onClick={() => dialogRef.current?.close()}
            className="grid size-10 shrink-0 place-items-center rounded-full border text-xl"
          >
            <AppIcon name="close" className="size-5" />
          </button>
        </div>
        <div className="p-5 sm:p-7">
          <ul className="space-y-4">
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
