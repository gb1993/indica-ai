"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import {
  initialActionState,
  type ActionState,
} from "@/lib/action-state";

type ActionHandler = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Salvando…",
  className,
  buttonClassName,
  confirmMessage,
  resetOnSuccess = false,
}: {
  action: ActionHandler;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previousState: ActionState, formData: FormData) => {
      const result = await action(previousState, formData);
      if (result.status === "success" && resetOnSuccess) formRef.current?.reset();
      return result;
    },
    initialActionState,
  );
  const fieldMessages = Object.values(state.fieldErrors ?? {}).flat();

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className={buttonClassName}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`basis-full text-sm ${
            state.status === "error" ? "text-red-500" : "text-emerald-500"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      {fieldMessages.length ? (
        <ul className="basis-full list-inside list-disc space-y-1 text-sm text-red-500">
          {fieldMessages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}
    </form>
  );
}
