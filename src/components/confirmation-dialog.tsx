"use client";

import { useEffect, useRef } from "react";

export function ConfirmationDialog({
  open,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={() => {
        if (open) onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border bg-(--surface) p-0 text-(--foreground) shadow-2xl backdrop:bg-black/70"
    >
      <div className="p-6 sm:p-7">
        <h2 id="confirmation-title" className="text-xl font-bold">Confirmar ação</h2>
        <p id="confirmation-description" className="mt-3 leading-relaxed text-(--muted)">{message}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-red-600 px-4 py-2.5 font-bold text-white">Confirmar</button>
        </div>
      </div>
    </dialog>
  );
}
