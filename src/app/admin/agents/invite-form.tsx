"use client";

import { Alert, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { inviteAgentAction } from "../actions";

export function InviteAgentForm() {
  const [state, formAction, formActionPending] = useFormAction(inviteAgentAction);
  return (
    <form onSubmit={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input name="name" placeholder="Full name" aria-label="Full name" required className="min-w-48 flex-1" />
        <Input name="email" type="email" placeholder="Email" aria-label="Email" required className="min-w-48 flex-1" />
        <SubmitButton pending={formActionPending} pendingText="Sending…">Send invitation</SubmitButton>
      </div>
      <p className="text-xs text-zinc-500">The agent receives an email and sets their own password. They start on Free.</p>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </form>
  );
}
