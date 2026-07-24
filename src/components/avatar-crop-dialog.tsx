"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { clampAvatarOffset } from "@/lib/avatar";

export const AVATAR_CROP_VIEWPORT_SIZE = 256;

export type AvatarCropSelection = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportSize: number;
};

export function AvatarCropDialog({
  open,
  sourceUrl,
  width,
  height,
  onCancel,
  onApply,
}: {
  open: boolean;
  sourceUrl: string;
  width: number;
  height: number;
  onCancel: () => void;
  onApply: (selection: AvatarCropSelection) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const clampOffset = (nextX: number, nextY: number, nextZoom = zoom) => {
    const clamped = clampAvatarOffset({
      width,
      height,
      zoom: nextZoom,
      offsetX: nextX,
      offsetY: nextY,
      viewportSize: AVATAR_CROP_VIEWPORT_SIZE,
    });
    return { x: clamped.offsetX, y: clamped.offsetY };
  };

  const scale = width > 0 && height > 0
    ? Math.max(AVATAR_CROP_VIEWPORT_SIZE / width, AVATAR_CROP_VIEWPORT_SIZE / height) * zoom
    : 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="avatar-crop-title"
      aria-describedby="avatar-crop-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={() => {
        if (open) onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border bg-(--surface) p-0 text-(--foreground) shadow-2xl backdrop:bg-black/75"
    >
      <div className="p-5 sm:p-7">
        <h2 id="avatar-crop-title" className="text-xl font-bold">Editar avatar</h2>
        <p id="avatar-crop-description" className="mt-2 text-sm text-(--muted)">
          Arraste a imagem e use o controle para ajustar o enquadramento.
        </p>

        <div className="mt-6 grid place-items-center rounded-2xl bg-black/40 p-2">
          <div
            className="relative size-64 touch-none cursor-grab overflow-hidden rounded-full bg-black ring-4 ring-white/90 active:cursor-grabbing"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerX: event.clientX,
                pointerY: event.clientY,
                offsetX: offset.x,
                offsetY: offset.y,
              };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag) return;
              setOffset(clampOffset(
                drag.offsetX + event.clientX - drag.pointerX,
                drag.offsetY + event.clientY - drag.pointerY,
              ));
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            <Image
              src={sourceUrl}
              alt="Prévia do recorte do avatar"
              width={width}
              height={height}
              unoptimized
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: width * scale,
                height: height * scale,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span aria-hidden="true" className="text-lg text-(--muted)">−</span>
          <label htmlFor="avatar-zoom" className="sr-only">Zoom do avatar</label>
          <input
            id="avatar-zoom"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setZoom(nextZoom);
              setOffset((current) => clampOffset(current.x, current.y, nextZoom));
            }}
            className="w-full accent-(--accent)"
          />
          <span aria-hidden="true" className="text-2xl text-(--muted)">+</span>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="app-button-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onApply({
              zoom,
              offsetX: offset.x,
              offsetY: offset.y,
              viewportSize: AVATAR_CROP_VIEWPORT_SIZE,
            })}
            className="app-button-primary"
          >
            Aplicar recorte
          </button>
        </div>
      </div>
    </dialog>
  );
}
