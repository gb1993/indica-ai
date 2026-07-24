"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

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

const OTP_EXPIRATION_SECONDS = 300;

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function EmailCodeForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const [secondsRemaining, setSecondsRemaining] = useState(
    OTP_EXPIRATION_SECONDS,
  );
  const [requestState, requestAction, requesting] = useActionState(
    requestEmailCode,
    initialRequestState,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyEmailCode,
    initialVerifyState,
  );

  const codeWasSent = requestState.status === "sent" && Boolean(requestState.email);

  useEffect(() => {
    if (!codeWasSent) return;

    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [codeWasSent]);

  if (codeWasSent && requestState.email) {
    const codeExpired = secondsRemaining === 0;

    return (
      <div className="space-y-5">
        <div className="rounded-xl border bg-(--surface-muted) px-4 py-3">
          <p className="text-sm text-(--muted)">Código enviado para</p>
          <p className="mt-1 truncate text-sm font-semibold">{requestState.email}</p>
        </div>

        <p
          role="timer"
          aria-live="polite"
          className={`text-center text-sm font-medium ${codeExpired ? "text-red-500" : "text-(--muted)"}`}
        >
          {codeExpired
            ? "O código expirou. Solicite um novo código."
            : `O código expira em ${formatCountdown(secondsRemaining)}.`}
        </p>

        <form action={verifyAction} className="space-y-3">
          <input type="hidden" name="email" value={requestState.email} />
          <input type="hidden" name="next" value={requestState.next ?? "/dashboard"} />
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
            disabled={codeExpired}
            className="app-input text-center text-xl font-bold tracking-[0.35em]"
          />
          <button
            type="submit"
            disabled={verifying || codeExpired}
            className="app-button-primary w-full disabled:opacity-60"
          >
            {verifying ? "Verificando…" : "Entrar"}
          </button>
          {verifyState.message ? (
            <p role="alert" className="text-sm text-red-500">
              {verifyState.message}
            </p>
          ) : null}
        </form>

        <Link
          href="/"
          className="block text-center text-sm text-(--muted) underline-offset-4 hover:underline"
        >
          {codeExpired ? "Solicitar novo código" : "Usar outro e-mail"}
        </Link>
      </div>
    );
  }

  return (
    <form action={requestAction} className="space-y-3">
      <input type="hidden" name="next" value={nextPath} />
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
        className="app-input text-sm"
      />
      <button
        type="submit"
        disabled={requesting}
        className="app-button-primary w-full disabled:opacity-60"
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
