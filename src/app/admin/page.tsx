import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, PlanBadge, Table, Td, Th } from "@/components/ui";
import { getAdminOverview, listPaymentsByStatus } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth/require";
import { formatDate, formatPHP } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  // Layout and page render in parallel, so the page checks the role itself before querying.
  await requireAdmin();
  const [o, pending] = await Promise.all([getAdminOverview(), listPaymentsByStatus("PENDING", 5)]);

  const stats = [
    { label: "Agents", value: o.total_agents.toLocaleString() },
    { label: "Paid agents", value: o.paid_agents.toLocaleString() },
    { label: "Free agents", value: o.free_agents.toLocaleString() },
    { label: "Pending payments", value: o.pending_payments.toLocaleString(), href: "/admin/payments" },
    { label: "Revenue this month", value: formatPHP(o.monthly_revenue_centavos), hint: "Approved payments only" },
    { label: "Expiring in 7 days", value: o.expiring_soon.toLocaleString(), href: "/admin/agents?filter=expiring" },
  ];

  return (
    <>
      <PageHeader title="Overview" />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <Card className="h-full">
              <p className="text-sm text-zinc-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
              {s.hint && <p className="mt-1 text-xs text-zinc-400">{s.hint}</p>}
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block rounded-xl hover:ring-2 hover:ring-brand-100">
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      <h2 className="mb-3 font-semibold">Pending payments ({o.pending_payments})</h2>
      {pending.length === 0 ? (
        <EmptyState>No payments waiting for review.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-zinc-50">
            <tr>
              <Th>Agent</Th>
              <Th>Plan</Th>
              <Th>Amount</Th>
              <Th>Reference</Th>
              <Th>Submitted</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {pending.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium text-zinc-900">{p.agent?.name || p.agent?.email}</Td>
                <Td>
                  <PlanBadge plan={p.plan_id} />
                </Td>
                <Td>{formatPHP(p.amount_centavos)}</Td>
                <Td className="font-mono">{p.gcash_reference}</Td>
                <Td>{formatDate(p.submitted_at)}</Td>
                <Td className="text-right">
                  <Link href={`/admin/payments/${p.id}`} className="font-medium text-brand-600 hover:underline">
                    Review
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
