"use client";

import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { updateSettingsAction } from "../actions";

type Settings = {
  gcashNumber: string;
  gcashAccountName: string;
  paymentInstructions: string;
  supportEmail: string;
  supportMessengerUrl: string;
  ttlDays: number;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction, formActionPending] = useFormAction(updateSettingsAction);
  return (
    <Card>
      <form onSubmit={formAction} className="space-y-4">
        <Field label="GCash number" htmlFor="gcashNumber">
          <Input id="gcashNumber" name="gcashNumber" defaultValue={initial.gcashNumber} placeholder="09XX XXX XXXX" />
        </Field>
        <Field label="GCash account name" htmlFor="gcashAccountName" hint="Use a business or short display name. Avoid exposing more personal details than needed.">
          <Input id="gcashAccountName" name="gcashAccountName" defaultValue={initial.gcashAccountName} />
        </Field>
        <Field label="Payment instructions" htmlFor="paymentInstructions">
          <Textarea id="paymentInstructions" name="paymentInstructions" rows={4} defaultValue={initial.paymentInstructions} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support email" htmlFor="supportEmail">
            <Input id="supportEmail" name="supportEmail" type="email" defaultValue={initial.supportEmail} />
          </Field>
          <Field label="Support Messenger URL" htmlFor="supportMessengerUrl">
            <Input id="supportMessengerUrl" name="supportMessengerUrl" type="url" defaultValue={initial.supportMessengerUrl} placeholder="https://m.me/..." />
          </Field>
        </div>
        <Field label="Expire unreviewed payments after (days)" htmlFor="ttlDays">
          <Input id="ttlDays" name="ttlDays" type="number" min={1} max={90} defaultValue={initial.ttlDays} className="w-32" />
        </Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
        <SubmitButton pending={formActionPending}>Save settings</SubmitButton>
      </form>
    </Card>
  );
}
