"use client";

import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { updatePlanAction } from "../actions";

type EditablePlan = {
  id: string;
  name: string;
  description: string;
  price: string;
  periodDays: number;
  maxListings: number | null;
  maxLeads: number | null;
  maxAi: number | null;
  active: boolean;
};

export function PlanEditor({ plan }: { plan: EditablePlan }) {
  const [state, formAction, formActionPending] = useFormAction(updatePlanAction.bind(null, plan.id));
  const isFree = plan.id === "free";
  const f = (id: string) => `${plan.id}-${id}`;

  return (
    <Card>
      <form onSubmit={formAction} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {plan.name} <span className="font-normal text-zinc-500">· {plan.periodDays}-day period</span>
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={plan.active} disabled={isFree} />
            Available for purchase
          </label>
          {isFree && <input type="hidden" name="active" value="on" />}
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Price (₱)" htmlFor={f("price")}>
            <Input id={f("price")} name="price" defaultValue={plan.price} readOnly={isFree} inputMode="decimal" required />
          </Field>
          <Field label="Active listings" htmlFor={f("listings")}>
            <Input id={f("listings")} name="maxListings" defaultValue={plan.maxListings ?? ""} inputMode="numeric" placeholder="No limit" />
          </Field>
          <Field label="Leads / month" htmlFor={f("leads")}>
            <Input id={f("leads")} name="maxLeads" defaultValue={plan.maxLeads ?? ""} inputMode="numeric" placeholder="No limit" />
          </Field>
          <Field label="AI generations / month" htmlFor={f("ai")}>
            <Input id={f("ai")} name="maxAi" defaultValue={plan.maxAi ?? ""} inputMode="numeric" placeholder="No limit" />
          </Field>
        </div>
        <Field label="Description" htmlFor={f("description")}>
          <Input id={f("description")} name="description" defaultValue={plan.description} maxLength={300} />
        </Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
        <SubmitButton pending={formActionPending} variant="secondary">Save {plan.name}</SubmitButton>
      </form>
    </Card>
  );
}
