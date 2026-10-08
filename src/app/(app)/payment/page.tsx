import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/require";
import { getPlan } from "@/lib/plans/catalog";
import { getMyPendingPayment, getPaymentSettings } from "@/lib/payments";
import { formatDate, formatPHP, todayInManila } from "@/lib/format";
import { isPaidPlanActive } from "@/lib/billing/expiry";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Pay with GCash" };

export default async function PaymentPage({ searchParams }: PageProps<"/payment">) {
  const { plan: planParam } = await searchParams;
  const user = await requireUser("/payment");
  const plan = typeof planParam === "string" ? await getPlan(planParam) : null;
  if (!plan || plan.id === "free" || !plan.active) redirect("/pricing");

  const [settings, pending] = await Promise.all([getPaymentSettings(), getMyPendingPayment(user.id)]);
  const price = formatPHP(plan.price_centavos);
  const isRenewal = user.profile.plan === plan.id && isPaidPlanActive(user.profile);
  const switching = !isRenewal && isPaidPlanActive(user.profile);

  if (pending) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Payment already submitted" />
        <Card className="space-y-4">
          <p className="text-sm text-zinc-700">
            Your {pending.plan?.name ?? pending.plan_id} payment from {formatDate(pending.submitted_at)} is still waiting
            for approval. You can submit another payment once it has been reviewed.
          </p>
          <ButtonLink href="/payment/pending">View payment status</ButtonLink>
        </Card>
      </div>
    );
  }

  const gcashReady = Boolean(settings?.gcash_number);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={isRenewal ? `Renew ${plan.name}` : `Upgrade to ${plan.name}`}
        description={`${price} for ${plan.billing_period_days} days`}
      />

      {isRenewal && user.profile.plan_expires_at && (
        <div className="mb-4">
          <Alert tone="info">
            Your current {plan.name} plan runs until {formatDate(user.profile.plan_expires_at)}. Renewing adds{" "}
            {plan.billing_period_days} days on top of that date.
          </Alert>
        </div>
      )}
      {switching && (
        <div className="mb-4">
          <Alert tone="warning">
            You are switching plans. Once approved, {plan.name} starts a fresh {plan.billing_period_days}-day period
            and replaces your current plan. Remaining days are not carried over.
          </Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">Pay using GCash</h2>
        {gcashReady ? (
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-zinc-500">Amount</dt>
            <dd className="font-semibold">{price}</dd>
            <dt className="text-zinc-500">GCash number</dt>
            <dd className="font-mono font-semibold">{settings!.gcash_number}</dd>
            <dt className="text-zinc-500">Account name</dt>
            <dd className="font-semibold">{settings!.gcash_account_name}</dd>
          </dl>
        ) : (
          <Alert tone="warning">GCash payments are not set up yet. Please contact support.</Alert>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>Send exactly {price} using GCash.</li>
          <li>Copy the reference number from your GCash receipt.</li>
          <li>Click &quot;I&apos;ve paid&quot; and submit the reference number below.</li>
          <li>Wait for approval. We&apos;ll notify you here once your plan is active.</li>
        </ol>
        {settings?.payment_instructions && (
          <p className="mt-4 whitespace-pre-line rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
            {settings.payment_instructions}
          </p>
        )}
      </Card>

      {gcashReady && <PaymentForm planId={plan.id} planName={plan.name} price={price} today={todayInManila()} />}

      {(settings?.support_email || settings?.support_messenger_url) && (
        <p className="mt-6 text-center text-xs text-zinc-500">
          Need help?{" "}
          {settings.support_email && (
            <a className="underline" href={`mailto:${settings.support_email}`}>
              {settings.support_email}
            </a>
          )}
          {settings.support_email && settings.support_messenger_url && " · "}
          {settings.support_messenger_url && (
            <a className="underline" href={settings.support_messenger_url} target="_blank" rel="noreferrer">
              Message us
            </a>
          )}
        </p>
      )}
    </div>
  );
}
