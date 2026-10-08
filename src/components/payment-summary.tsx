import type { Payment } from "@/lib/database.types";
import { formatDate, formatPHP } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/ui";

export function PaymentSummary({ payment }: { payment: Payment & { plan?: { name: string } | null } }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-zinc-500">Status</dt>
      <dd>
        <PaymentStatusBadge status={payment.status} />
      </dd>
      <dt className="text-zinc-500">Submitted</dt>
      <dd>{formatDate(payment.submitted_at)}</dd>
      <dt className="text-zinc-500">Plan</dt>
      <dd>{payment.plan?.name ?? payment.plan_id}</dd>
      <dt className="text-zinc-500">Amount</dt>
      <dd>{formatPHP(payment.amount_centavos)}</dd>
      <dt className="text-zinc-500">Reference</dt>
      <dd className="font-mono">{payment.gcash_reference}</dd>
      {payment.status === "REJECTED" && (
        <>
          <dt className="text-zinc-500">Reason</dt>
          <dd className="text-red-700">{payment.rejection_reason}</dd>
        </>
      )}
    </dl>
  );
}
