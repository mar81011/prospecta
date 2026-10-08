"use client";

import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { setPassword } from "@/app/(auth)/actions";

export function SetPasswordForm({ email }: { email: string }) {
  const [state, formAction, formActionPending] = useFormAction(setPassword);
  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold">Set your password</h1>
      <p className="mb-6 text-sm text-zinc-600">For {email}</p>
      <form onSubmit={formAction} className="space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <SubmitButton pending={formActionPending} className="w-full">Save password</SubmitButton>
      </form>
    </Card>
  );
}
