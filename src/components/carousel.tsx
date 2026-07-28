"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AppIcon } from "./app-icon";

export function Carousel({
  children,
  ariaLabel,
  slideClassName = "basis-full",
  loop = false,
  autoplay = false,
  autoplayDelay = 4500,
}: {
  children: ReactNode;
  ariaLabel: string;
  slideClassName?: string;
  loop?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number;
}) {
  const slides = useMemo(() => Array.isArray(children) ? children : [children], [children]);
  const [autoplayPlugin] = useState(() => Autoplay({
    delay: autoplayDelay,
    playOnInit: autoplay,
    stopOnInteraction: false,
    stopOnMouseEnter: true,
  }));
  const plugins = useMemo(
    () => autoplay ? [autoplayPlugin] : [],
    [autoplay, autoplayPlugin],
  );
  const [viewportRef, emblaApi] = useEmblaCarousel(
    { align: "start", containScroll: "trimSnaps", loop },
    plugins,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateControls = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const animationFrame = window.requestAnimationFrame(updateControls);
    emblaApi.on("select", updateControls);
    emblaApi.on("reInit", updateControls);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      emblaApi.off("select", updateControls);
      emblaApi.off("reInit", updateControls);
    };
  }, [emblaApi, updateControls]);

  useEffect(() => {
    if (!autoplay) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncAutoplay = () => {
      if (reducedMotion.matches) autoplayPlugin.stop();
      else autoplayPlugin.play();
    };
    syncAutoplay();
    reducedMotion.addEventListener("change", syncAutoplay);
    return () => reducedMotion.removeEventListener("change", syncAutoplay);
  }, [autoplay, autoplayPlugin]);

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label={ariaLabel}
      onFocusCapture={() => autoplayPlugin.stop()}
      onBlurCapture={(event) => {
        if (
          autoplay
          && !event.currentTarget.contains(event.relatedTarget as Node | null)
          && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          autoplayPlugin.play();
        }
      }}
    >
      <div ref={viewportRef} className="overflow-hidden">
        <div className="-ml-4 flex touch-pan-y">
          {slides.map((slide, index) => (
            <div
              key={index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} de ${slides.length}`}
              className={`min-w-0 shrink-0 pl-4 ${slideClassName}`}
            >
              <div className="h-full">{slide}</div>
            </div>
          ))}
        </div>
      </div>

      {scrollSnaps.length > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex gap-2" aria-label="Selecionar página do carrossel">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Ir para a página ${index + 1}`}
                aria-current={index === selectedIndex ? "true" : undefined}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-2 rounded-full transition-all ${
                  index === selectedIndex
                    ? "w-7 bg-(--accent)"
                    : "w-2 bg-(--border) hover:bg-(--muted)"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Itens anteriores"
              disabled={!canScrollPrev}
              onClick={() => emblaApi?.scrollPrev()}
              className="grid size-10 place-items-center rounded-full border bg-(--surface) text-(--foreground) shadow-sm disabled:opacity-35"
            >
              <AppIcon name="chevron" className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Próximos itens"
              disabled={!canScrollNext}
              onClick={() => emblaApi?.scrollNext()}
              className="grid size-10 place-items-center rounded-full border bg-(--surface) text-(--foreground) shadow-sm disabled:opacity-35"
            >
              <AppIcon name="chevron" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
