import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { PaymentSummary } from "@/components/payment-summary";
import { requireUser } from "@/lib/auth/require";
import { getMyLatestPayment } from "@/lib/payments";

export const metadata: Metadata = { title: "Payment status" };

export default async function PaymentPendingPage({ searchParams }: PageProps<"/payment/pending">) {
  const { upload } = await searchParams;
  const user = await requireUser();
  const payment = await getMyLatestPayment(user.id);
  if (!payment) redirect("/pricing");
  if (payment.status === "APPROVED") redirect("/payment/success");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Payment status" />
      {upload === "failed" && (
        <Alert tone="warning">
          Your payment was submitted, but the screenshot could not be uploaded. The reference number is enough for review.
        </Alert>
      )}
      <Card className="space-y-4">
        {payment.status === "PENDING" && (
          <p className="text-sm text-zinc-700">
            Thanks! We&apos;re checking your GCash payment. Your plan will be activated as soon as it&apos;s approved, and
            you&apos;ll get a notification here.
          </p>
        )}
        {payment.status === "REJECTED" && (
          <Alert tone="error">Payment could not be verified. Please review the reason below and submit a new payment.</Alert>
        )}
        {payment.status === "EXPIRED" && (
          <Alert tone="warning">
            This payment request expired before it was reviewed. If you already paid, contact support or submit it again.
          </Alert>
        )}
        <PaymentSummary payment={payment} />
        <div className="flex flex-wrap gap-2 pt-2">
          {payment.status !== "PENDING" && <ButtonLink href={`/payment?plan=${payment.plan_id}`}>Submit a new payment</ButtonLink>}
          <ButtonLink href="/dashboard" variant="secondary">
            Back to dashboard
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
