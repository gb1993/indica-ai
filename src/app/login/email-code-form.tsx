"use client";

import { useActionState } from "react";

import {
  requestEmailCode,
  type RequestCodeState,
  verifyEmailCode,
  type VerifyCodeState,
} from "./actions";

const initialRequestState: RequestCodeState = {
  status: "idle",
  message: "",
};

const initialVerifyState: VerifyCodeState = {
  status: "idle",
  message: "",
};

export function EmailCodeForm() {
  const [requestState, requestAction, requesting] = useActionState(
    requestEmailCode,
    initialRequestState,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyEmailCode,
    initialVerifyState,
  );

  if (requestState.status === "sent" && requestState.email) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">Código enviado para</p>
          <p className="mt-1 truncate text-sm font-semibold">{requestState.email}</p>
        </div>

        <form action={verifyAction} className="space-y-3">
          <input type="hidden" name="email" value={requestState.email} />
          <label htmlFor="token" className="block text-sm font-medium">
            Código de acesso
          </label>
          <input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            minLength={6}
            maxLength={10}
            pattern="[0-9]*"
            placeholder="00000000"
            className="w-full rounded-xl border bg-[var(--surface-muted)] px-4 py-3 text-center text-xl font-bold tracking-[0.35em] placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[#07150c] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {verifying ? "Verificando…" : "Entrar"}
          </button>
          {verifyState.message ? (
            <p role="alert" className="text-sm text-red-500">
              {verifyState.message}
            </p>
          ) : null}
        </form>

        <a
          href="/login"
          className="block text-center text-sm text-[var(--muted)] underline-offset-4 hover:underline"
        >
          Usar outro e-mail
        </a>
      </div>
    );
  }

  return (
    <form action={requestAction} className="space-y-3">
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
        disabled={requesting}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[#07150c] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        {requesting ? "Enviando…" : "Receber código por e-mail"}
      </button>
      {requestState.message ? (
        <p role="alert" className="text-sm text-red-500">
          {requestState.message}
        </p>
      ) : null}
    </form>
  );
}
