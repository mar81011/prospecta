"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { initialFormState, type FormState } from "./state";

/**
 * Like useActionState, but keeps what the user typed. React resets a form after
 * every `<form action>` submission, so a validation error would wipe all fields.
 * Submitting through onSubmit avoids the reset.
 */
export function useFormAction(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };
  return [state, onSubmit, pending] as const;
}
