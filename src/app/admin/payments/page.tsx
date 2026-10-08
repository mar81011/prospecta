import type { Metadata } from "next";
import Link from "next/link";
import { cx, EmptyState, PageHeader, PaymentStatusBadge, PlanBadge, Table, Td, Th } from "@/components/ui";
import { countPaymentsByStatus, listPaymentsByStatus } from "@/lib/admin-data";
import { formatDate, formatPHP } from "@/lib/format";
import type { PaymentStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Payments · Admin" };

const TABS: { status: PaymentStatus; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
  { status: "EXPIRED", label: "Expired" },
];

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t.status === raw)?.status ?? "PENDING";
  const [payments, counts] = await Promise.all([listPaymentsByStatus(status), countPaymentsByStatus()]);

  return (
    <>
      <PageHeader title="Payments" description="Check each reference in the GCash app before approving." />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/payments?status=${t.status}`}
            className={cx(
              "-mb-px border-b-2 px-4 py-2 text-sm",
              t.status === status ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900",
            )}
          >
            {t.label} <span className="text-zinc-400">({counts[t.status]})</span>
          </Link>
        ))}
      </div>
      {payments.length === 0 ? (
        <EmptyState>No {status.toLowerCase()} payments.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-zinc-50">
            <tr>
              <Th>Agent</Th>
              <Th>Plan</Th>
              <Th>Amount</Th>
              <Th>Reference</Th>
              <Th>Paid on</Th>
              <Th>Submitted</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <Td>
                  <p className="font-medium text-zinc-900">{p.agent?.name || "—"}</p>
                  <p className="text-xs text-zinc-500">{p.agent?.email}</p>
                </Td>
                <Td>
                  <PlanBadge plan={p.plan_id} />
                </Td>
                <Td>{formatPHP(p.amount_centavos)}</Td>
                <Td className="font-mono">{p.gcash_reference}</Td>
                <Td>{formatDate(p.payment_date)}</Td>
                <Td>{formatDate(p.submitted_at)}</Td>
                <Td>
                  <PaymentStatusBadge status={p.status} />
                </Td>
                <Td className="text-right">
                  <Link href={`/admin/payments/${p.id}`} className="font-medium text-brand-600 hover:underline">
                    {p.status === "PENDING" ? "Review" : "View"}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
