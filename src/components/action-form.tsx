"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import {
  initialActionState,
  type ActionState,
} from "@/lib/action-state";

import { ConfirmationDialog } from "./confirmation-dialog";
import { Toast } from "./toast";

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
  submitAriaLabel,
  submitTitle,
  confirmMessage,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: ActionHandler;
  children: ReactNode;
  submitLabel: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
  buttonClassName?: string;
  submitAriaLabel?: string;
  submitTitle?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: ActionState, formData: FormData) => {
      setToastVisible(false);
      const result = await action(previousState, formData);
      if (result.status === "success") {
        if (resetOnSuccess) formRef.current?.reset();
        onSuccess?.();
      }
      if (result.message) setToastVisible(true);
      return result;
    },
    initialActionState,
  );
  const fieldMessages = Object.values(state.fieldErrors ?? {}).flat();

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        aria-busy={pending}
        onSubmit={(event) => {
          if (confirmMessage && !confirmedRef.current) {
            event.preventDefault();
            setConfirmationOpen(true);
            return;
          }
          confirmedRef.current = false;
        }}
      >
        {children}
        <button
          type="submit"
          disabled={pending}
          className={buttonClassName}
          aria-label={submitAriaLabel}
          title={submitTitle}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {fieldMessages.length ? (
          <ul role="alert" className="basis-full list-inside list-disc space-y-1 text-sm text-red-600 dark:text-red-400">
            {fieldMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
          </ul>
        ) : null}
      </form>
      {confirmMessage ? (
        <ConfirmationDialog
          open={confirmationOpen}
          message={confirmMessage}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={() => {
            confirmedRef.current = true;
            setConfirmationOpen(false);
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
      {toastVisible && state.message && state.status !== "idle" ? (
        <Toast status={state.status} message={state.message} onDismiss={() => setToastVisible(false)} />
      ) : null}
    </>
  );
}
