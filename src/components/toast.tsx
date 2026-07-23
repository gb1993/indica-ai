"use client";

export function Toast({
  status,
  message,
  onDismiss,
}: {
  status: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "error" ? "assertive" : "polite"}
      className={`fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border p-4 shadow-2xl sm:max-w-sm ${
        status === "error"
          ? "border-red-500/40 bg-(--surface) text-red-600 dark:text-red-400"
          : "border-emerald-500/40 bg-(--surface) text-emerald-700 dark:text-emerald-300"
      }`}
    >
      <span aria-hidden>{status === "error" ? "⚠" : "✓"}</span>
      <p className="min-w-0 flex-1 text-sm font-medium">{message}</p>
      <button type="button" onClick={onDismiss} aria-label="Fechar aviso" className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-(--surface-muted)">×</button>
    </div>
  );
}
