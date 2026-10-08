import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { listPlans } from "@/lib/plans/catalog";
import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = { title: "Plans · Admin" };

export default async function AdminPlansPage() {
  const plans = await listPlans({ includeInactive: true });
  return (
    <>
      <PageHeader
        title="Plans"
        description="Prices and limits are read from here everywhere in the app and enforced by the database. Leave a limit blank for no fixed limit (fair use)."
      />
      <div className="space-y-6">
        {plans.map((p) => (
          <PlanEditor
            key={p.id}
            plan={{
              id: p.id,
              name: p.name,
              description: p.description,
              price: String(p.price_centavos / 100),
              periodDays: p.billing_period_days,
              maxListings: p.max_active_listings,
              maxLeads: p.max_leads_per_month,
              maxAi: p.max_ai_generations_per_month,
              active: p.active,
            }}
          />
        ))}
      </div>
    </>
  );
}
