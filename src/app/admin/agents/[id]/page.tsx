import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, PageHeader, PaymentStatusBadge, PlanBadge, Table, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/require";
import { getAgent } from "@/lib/admin-data";
import { listPlans } from "@/lib/plans/catalog";
import { effectivePlan } from "@/lib/billing/expiry";
import { formatDate, formatDateTime, formatPHP } from "@/lib/format";
import { RoleButton, SetPlanForm } from "./agent-forms";

export const metadata: Metadata = { title: "Agent · Admin" };

export default async function AdminAgentPage({ params }: PageProps<"/admin/agents/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [me, agent, plans] = await Promise.all([requireAdmin(), getAgent(id), listPlans({ includeInactive: true })]);
  if (!agent) notFound();
  const { profile, payments } = agent;
  const eff = effectivePlan(profile);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/agents" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← All agents
      </Link>
      <PageHeader
        title={profile.name || profile.email || profile.phone}
        description={profile.email || profile.phone}
        actions={profile.role === "admin" && <Badge className="bg-brand-100 text-brand-700">admin</Badge>}
      />

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Subscription</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-zinc-500">Entitled to</dt>
            <dd>
              <PlanBadge plan={eff} />
            </dd>
            <dt className="text-zinc-500">Stored plan</dt>
            <dd>
              {profile.plan} · {profile.plan_status}
            </dd>
            <dt className="text-zinc-500">Expires</dt>
            <dd>{profile.plan === "free" ? "—" : formatDateTime(profile.plan_expires_at)}</dd>
            <dt className="text-zinc-500">Joined</dt>
            <dd>{formatDate(profile.created_at)}</dd>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Change plan manually</h2>
          <p className="mb-3 text-xs text-zinc-500">
            For corrections and complimentary access. Normal upgrades go through payment approval. Recorded in the audit log.
          </p>
          <SetPlanForm
            agentId={profile.id}
            plans={plans.map((p) => ({ id: p.id, name: p.name }))}
            current={{
              plan: profile.plan,
              status: profile.plan_status,
              expiresAt: profile.plan_expires_at
                ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(profile.plan_expires_at))
                : "",
            }}
          />
        </Card>
      </div>

      {profile.id !== me.id && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Role</h2>
            <p className="text-sm text-zinc-600">
              {profile.role === "admin" ? "Can review payments and manage agents." : "Regular agent account."}
            </p>
          </div>
          <RoleButton userId={profile.id} role={profile.role} />
        </Card>
      )}

      <h2 className="mb-3 font-semibold">Payments</h2>
      {payments.length === 0 ? (
        <EmptyState>No payments.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-zinc-50">
            <tr>
              <Th>Submitted</Th>
              <Th>Plan</Th>
              <Th>Amount</Th>
              <Th>Reference</Th>
              <Th>Status</Th>
              <Th />
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
                <Td className="text-right">
                  <Link href={`/admin/payments/${p.id}`} className="text-brand-600 hover:underline">
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
