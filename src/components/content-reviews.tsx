"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type ContentReview = {
  id: string;
  rating: number;
  comment: string | null;
  updatedAt: string;
  memberName: string;
};

function subscribeToDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ReviewCard({ review }: { review: ContentReview }) {
  return (
    <article className="flex h-full min-h-44 flex-col rounded-2xl border bg-(--surface-muted) p-5">
      <p
        className="text-xl tracking-wider text-amber-500"
        aria-label={`${review.rating} de 5 estrelas`}
      >
        <span aria-hidden>
          {"★".repeat(review.rating)}
          <span className="text-(--border)">{"★".repeat(5 - review.rating)}</span>
        </span>
      </p>
      <p className="mt-3 font-bold">{review.memberName}</p>
      <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${review.comment ? "" : "italic text-(--muted)"}`}>
        {review.comment ?? "Sem comentário."}
      </p>
    </article>
  );
}

function SliderTrack({
  reviews,
  visibleCount,
  autoplay,
}: {
  reviews: ContentReview[];
  visibleCount: number;
  autoplay: boolean;
}) {
  const [index, setIndex] = useState(visibleCount);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const canSlide = reviews.length > visibleCount;
  const leadingClones = reviews.slice(-visibleCount);
  const trailingClones = reviews.slice(0, visibleCount);
  const slides = canSlide
    ? [...leadingClones, ...reviews, ...trailingClones]
    : reviews;

  useEffect(() => {
    if (!canSlide || paused || !autoplay) return;

    const interval = window.setInterval(() => {
      setTransitionEnabled(true);
      setIndex((current) => current + 1);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [autoplay, canSlide, paused]);

  if (!canSlide) {
    return (
      <div className={`grid gap-4 ${reviews.length > 1 ? "md:grid-cols-2" : ""}`}>
        {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      </div>
    );
  }

  const slideWidth = 100 / visibleCount;

  return (
    <div
      className="overflow-hidden"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques das avaliações"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * slideWidth}%)`,
          transition: transitionEnabled ? "transform 500ms ease" : "none",
        }}
        onTransitionEnd={() => {
          if (index >= reviews.length + visibleCount) {
            setTransitionEnabled(false);
            setIndex(visibleCount);
          }
        }}
      >
        {slides.map((review, slideIndex) => {
          const isClone = slideIndex < visibleCount
            || slideIndex >= reviews.length + visibleCount;
          return (
            <div
              key={`${review.id}-${slideIndex}`}
              className="shrink-0 px-2"
              style={{ width: `${slideWidth}%` }}
              aria-hidden={isClone || undefined}
            >
              <ReviewCard review={review} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ContentReviews({ reviews }: { reviews: ContentReview[] }) {
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    () => false,
  );
  const visibleCount = isDesktop && reviews.length > 1 ? 2 : 1;
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
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
      <SliderTrack
        key={visibleCount}
        reviews={reviews}
        visibleCount={visibleCount}
        autoplay={!reducedMotion}
      />

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
            <span aria-hidden>×</span>
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
