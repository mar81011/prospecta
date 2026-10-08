"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import type { PlanStatus, UserRole } from "@/lib/database.types";
import { setAgentPlanAction, setRoleAction } from "../../actions";

export function SetPlanForm({
  agentId,
  plans,
  current,
}: {
  agentId: string;
  plans: { id: string; name: string }[];
  current: { plan: string; status: PlanStatus; expiresAt: string };
}) {
  const [state, formAction, formActionPending] = useFormAction(setAgentPlanAction.bind(null, agentId));
  const [plan, setPlan] = useState(current.plan);
  const isFree = plan === "free";

  return (
    <form onSubmit={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plan" htmlFor="plan">
          <Select id="plan" name="plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={current.status} disabled={isFree}>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="cancelled">cancelled</option>
            <option value="pending">pending</option>
          </Select>
        </Field>
      </div>
      {isFree && <input type="hidden" name="status" value="active" />}
      {!isFree && (
        <Field label="Expires on" htmlFor="expiresAt" hint="End of this day, Philippine time.">
          <Input id="expiresAt" name="expiresAt" type="date" defaultValue={current.expiresAt} required />
        </Field>
      )}
      <Field label="Note for the audit log" htmlFor="note">
        <Input id="note" name="note" maxLength={500} placeholder="e.g. Complimentary month for beta feedback" />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton pending={formActionPending} variant="secondary">Save plan</SubmitButton>
    </form>
  );
}

export function RoleButton({ userId, role }: { userId: string; role: UserRole }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const next: UserRole = role === "admin" ? "agent" : "admin";
  return (
    <div className="text-right">
      <Button
        variant={next === "admin" ? "secondary" : "danger"}
        disabled={pending}
        onClick={() => {
          const msg =
            next === "admin"
              ? "Make this user an admin? They will be able to approve payments and manage agents."
              : "Remove admin access from this user?";
          if (!confirm(msg)) return;
          startTransition(async () => setError((await setRoleAction(userId, next)).error));
        }}
      >
        {next === "admin" ? "Make admin" : "Remove admin"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
