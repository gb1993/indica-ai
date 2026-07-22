"use client";

import { useActionState } from "react";

import { requestMagicLink, type MagicLinkState } from "./actions";

const initialState: MagicLinkState = { status: "idle", message: "" };

export function MagicLinkForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initialState);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="email" className="block text-sm font-medium">
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        placeholder="voce@exemplo.com"
        className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3 text-sm placeholder:text-[var(--muted)]"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl border bg-[var(--surface)] px-4 py-3 text-sm font-semibold transition hover:bg-[var(--surface-muted)] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Receber link mágico"}
      </button>
      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.status === "error" ? "text-red-500" : "text-[var(--muted)]"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
