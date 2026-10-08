import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { PlanCards } from "@/components/plan-cards";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/require";
import { listPlans } from "@/lib/plans/catalog";
import { effectivePlan } from "@/lib/billing/expiry";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const [user, plans] = await Promise.all([getCurrentUser(), listPlans()]);
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <PageHeader
          title="Plans"
          description="Start free. Upgrade when you need more listings, leads and AI help. Paid plans run for 30 days and are paid via GCash."
        />
        <PlanCards plans={plans} signedIn={Boolean(user)} currentPlan={user ? effectivePlan(user.profile) : undefined} />
        <p className="mt-8 text-center text-xs text-zinc-500">
          Paid plans are activated after we confirm your GCash payment, usually within one business day.
        </p>
      </main>
    </>
  );
}
