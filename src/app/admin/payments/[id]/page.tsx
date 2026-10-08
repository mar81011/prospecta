import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, PageHeader, PaymentStatusBadge } from "@/components/ui";
import { findPaymentsWithReference, getPaymentForReview } from "@/lib/admin-data";
import { getScreenshotUrl } from "@/lib/billing/providers/manual-gcash";
import { REJECTION_REASONS } from "@/lib/billing/review";
import { formatDate, formatDateTime, formatPHP } from "@/lib/format";
import { ReviewForms } from "./review-forms";

export const metadata: Metadata = { title: "Review payment · Admin" };

export default async function AdminPaymentDetailPage({ params, searchParams }: PageProps<"/admin/payments/[id]">) {
  const { id } = await params;
  const { done } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const payment = await getPaymentForReview(id);
  if (!payment) notFound();

  const [screenshotUrl, sameReference] = await Promise.all([
    getScreenshotUrl(payment.screenshot_path),
    findPaymentsWithReference(payment.gcash_reference, payment.id),
  ]);

  const rows: [string, React.ReactNode][] = [
    ["Agent", payment.agent?.name || "—"],
    [
      "Email",
      payment.agent ? (
        <Link href={`/admin/agents/${payment.agent.id}`} className="text-brand-600 hover:underline">
          {payment.agent.email}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Plan", payment.plan?.name ?? payment.plan_id],
    ["Amount", <strong key="a">{formatPHP(payment.amount_centavos)}</strong>],
    ["GCash reference", <span key="r" className="font-mono text-base font-semibold">{payment.gcash_reference}</span>],
    ["Payment date", formatDate(payment.payment_date)],
    ["Submitted", formatDateTime(payment.submitted_at)],
    ["Notes", payment.notes || "—"],
  ];

  return (
    <div className="max-w-3xl">
      <Link href="/admin/payments" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← All payments
      </Link>
      <PageHeader title="Payment details" actions={<PaymentStatusBadge status={payment.status} />} />

      {done === "approved" && (
        <div className="mb-4">
          <Alert tone="success">Payment approved and plan activated. The agent has been notified.</Alert>
        </div>
      )}
      {done === "rejected" && (
        <div className="mb-4">
          <Alert tone="success">Payment rejected. The agent has been notified with the reason.</Alert>
        </div>
      )}

      {sameReference.length > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            This GCash reference also appears on {sameReference.length} other payment
            {sameReference.length === 1 ? "" : "s"}:{" "}
            {sameReference.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <Link href={`/admin/payments/${p.id}`} className="underline">
                  {p.agent?.name || p.agent?.email} ({p.status.toLowerCase()})
                </Link>
              </span>
            ))}
          </Alert>
        </div>
      )}

      <Card className="mb-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-900">{value}</dd>
            </div>
          ))}
          <dt className="text-zinc-500">Screenshot</dt>
          <dd>
            {screenshotUrl ? (
              <a href={screenshotUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                View screenshot (link valid for 60 seconds)
              </a>
            ) : (
              "None uploaded"
            )}
          </dd>
          {payment.status !== "PENDING" && (
            <>
              <dt className="text-zinc-500">Reviewed by</dt>
              <dd>{payment.reviewer?.name || payment.reviewer?.email || "System"}</dd>
            </>
          )}
          {payment.status === "APPROVED" && (
            <>
              <dt className="text-zinc-500">Approved</dt>
              <dd>{formatDateTime(payment.approved_at)}</dd>
            </>
          )}
          {payment.status === "REJECTED" && (
            <>
              <dt className="text-zinc-500">Rejected</dt>
              <dd>
                {formatDateTime(payment.rejected_at)} · <span className="text-red-700">{payment.rejection_reason}</span>
              </dd>
            </>
          )}
        </dl>
      </Card>

      {payment.status === "PENDING" && (
        <ReviewForms
          paymentId={payment.id}
          summary={`${formatPHP(payment.amount_centavos)} · ref ${payment.gcash_reference}`}
          reasons={[...REJECTION_REASONS]}
        />
      )}
    </div>
  );
}
