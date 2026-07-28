"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`m-auto max-h-[90vh] w-[calc(100%_-_2rem)] ${widths[size]} overflow-hidden rounded-2xl border bg-(--surface) p-0 text-(--foreground) shadow-2xl shadow-black/35 backdrop:bg-black/75 backdrop:backdrop-blur-xs`}
    >
      <div className="flex items-start justify-between gap-5 border-b px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-bold tracking-tight">{title}</h2>
          {description ? (
            <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-(--muted)">
              {description}
            </p>
          ) : null}
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Fechar modal"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full border bg-(--surface-muted) text-lg text-(--muted) hover:border-(--accent) hover:text-(--accent)"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      <div className="max-h-[calc(90vh-6rem)] overflow-y-auto p-5 sm:p-6">
        {children}
      </div>
    </dialog>
  );
}
