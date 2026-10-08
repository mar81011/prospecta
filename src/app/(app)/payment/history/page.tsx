import type { Metadata } from "next";
import { EmptyState, PageHeader, PaymentStatusBadge, Table, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth/require";
import { listMyPayments } from "@/lib/payments";
import { formatDate, formatPHP } from "@/lib/format";

export const metadata: Metadata = { title: "Payment history" };

export default async function PaymentHistoryPage() {
  const user = await requireUser();
  const payments = await listMyPayments(user.id);

  return (
    <>
      <PageHeader title="Payment history" description="All GCash payments you've submitted." />
      {payments.length === 0 ? (
        <EmptyState>No payments yet.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-zinc-50">
            <tr>
              <Th>Date</Th>
              <Th>Plan</Th>
              <Th>Amount</Th>
              <Th>Reference</Th>
              <Th>Status</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <Td>{formatDate(p.submitted_at)}</Td>
                <Td>{p.plan?.name ?? p.plan_id}</Td>
                <Td>{formatPHP(p.amount_centavos)}</Td>
                <Td className="font-mono">{p.gcash_reference}</Td>
                <Td>
                  <PaymentStatusBadge status={p.status} />
                </Td>
                <Td className="whitespace-normal text-xs">
                  {p.status === "REJECTED" && <span className="text-red-700">{p.rejection_reason}</span>}
                  {p.status === "APPROVED" && `Approved ${formatDate(p.approved_at)}`}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
