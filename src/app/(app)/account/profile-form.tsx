"use client";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { updateProfile } from "./actions";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, onSubmit, pending] = useFormAction(updateProfile);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name" htmlFor="name" hint="Shown on your public listing pages.">
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required minLength={2} maxLength={100} />
      </Field>
      <Field label="Mobile number" htmlFor="phone" hint="Buyers can call or text you from your listing pages. Leave blank to hide it.">
        <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" placeholder="0917 123 4567" maxLength={30} />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton pending={pending}>Save profile</SubmitButton>
    </form>
  );
}
