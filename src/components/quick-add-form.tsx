"use client";

import { useEffect, useRef } from "react";
import { Alert, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import type { FormState } from "@/lib/actions/state";

export function QuickAddForm({
  action,
  name,
  placeholder,
  submitLabel,
  extra,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  name: string;
  placeholder: string;
  submitLabel: string;
  extra?: { name: string; placeholder: string };
}) {
  const [state, formAction, formActionPending] = useFormAction(action);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input name={name} placeholder={placeholder} required maxLength={200} className="min-w-48 flex-1" aria-label={placeholder} />
        {extra && (
          <Input name={extra.name} placeholder={extra.placeholder} maxLength={200} className="min-w-48 flex-1" aria-label={extra.placeholder} />
        )}
        <SubmitButton pending={formActionPending} pendingText="Adding…">{submitLabel}</SubmitButton>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
