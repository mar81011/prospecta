"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { submitPayment } from "./actions";

export function PaymentForm({
  planId,
  planName,
  price,
  today,
}: {
  planId: string;
  planName: string;
  price: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, formActionPending] = useFormAction(submitPayment);

  if (!open) {
    return (
      <Button className="w-full py-3" onClick={() => setOpen(true)}>
        I&apos;ve paid
      </Button>
    );
  }

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Submit your payment</h2>
      <form onSubmit={formAction} className="space-y-4">
        <input type="hidden" name="plan" value={planId} />
        <dl className="grid grid-cols-2 gap-4 rounded-lg bg-zinc-50 p-3 text-sm">
          <div>
            <dt className="text-zinc-500">Plan</dt>
            <dd className="font-semibold">{planName}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Amount</dt>
            <dd className="font-semibold">{price}</dd>
          </div>
        </dl>
        <Field label="GCash reference number" htmlFor="reference" hint="Shown on your GCash receipt, e.g. 1234 567 890123.">
          <Input id="reference" name="reference" inputMode="numeric" autoComplete="off" required maxLength={30} />
        </Field>
        <Field label="Payment date" htmlFor="paymentDate">
          <Input id="paymentDate" name="paymentDate" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Screenshot (optional)" htmlFor="screenshot" hint="JPG, PNG or WebP, up to 5 MB.">
          <Input
            id="screenshot"
            name="screenshot"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm"
          />
        </Field>
        <Field label="Notes (optional)" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} maxLength={1000} />
        </Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <SubmitButton pending={formActionPending} className="w-full" pendingText="Submitting…">
          Submit payment
        </SubmitButton>
      </form>
    </Card>
  );
}
