"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { approvePaymentAction, rejectPaymentAction } from "../../actions";

export function ReviewForms({ paymentId, summary, reasons }: { paymentId: string; summary: string; reasons: string[] }) {
  const [approveState, approve, approvePending] = useFormAction(approvePaymentAction.bind(null, paymentId));
  const [rejectState, reject, rejectPending] = useFormAction(rejectPaymentAction.bind(null, paymentId));
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState(reasons[0]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-3">
        <h2 className="font-semibold">Approve</h2>
        <p className="text-sm text-zinc-600">
          Only approve after finding this exact transaction ({summary}) in the GCash app.
        </p>
        {approveState.error && <Alert tone="error">{approveState.error}</Alert>}
        {!confirming ? (
          <Button className="w-full" onClick={() => setConfirming(true)}>
            Approve payment
          </Button>
        ) : (
          <form onSubmit={approve} className="space-y-2">
            <Alert tone="warning">I confirm I found this transaction in GCash for the correct amount.</Alert>
            <div className="flex gap-2">
              <SubmitButton pending={approvePending} className="flex-1" pendingText="Approving…">
                Yes, approve
              </SubmitButton>
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Reject</h2>
        <form onSubmit={reject} className="space-y-3">
          <Field label="Reason" htmlFor="reason">
            <Select id="reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field
            label={reason === "Other" ? "Details (required)" : "Details (optional)"}
            htmlFor="details"
            hint="The agent will see this."
          >
            <Textarea id="details" name="details" rows={2} maxLength={400} required={reason === "Other"} />
          </Field>
          {rejectState.error && <Alert tone="error">{rejectState.error}</Alert>}
          <SubmitButton pending={rejectPending} variant="danger" className="w-full" pendingText="Rejecting…">
            Reject payment
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
