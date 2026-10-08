import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/require";
import { isPaidPlanActive } from "@/lib/billing/expiry";
import { getPlan } from "@/lib/plans/catalog";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Plan active" };

export default async function PaymentSuccessPage() {
  const user = await requireUser();
  if (!isPaidPlanActive(user.profile)) redirect("/payment/pending");
  const plan = await getPlan(user.profile.plan);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Payment approved" />
      <Card className="space-y-4">
        <p className="text-zinc-700">
          Your <strong>{plan?.name}</strong> plan is active until{" "}
          <strong>{formatDate(user.profile.plan_expires_at)}</strong>.
        </p>
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
      </Card>
    </div>
  );
}
