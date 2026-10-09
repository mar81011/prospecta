import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, cx, EmptyState, Input, PageHeader, PlanBadge, Table, Td, Th } from "@/components/ui";
import { listAgents } from "@/lib/admin-data";
import { effectivePlan } from "@/lib/billing/expiry";
import { formatDate } from "@/lib/format";
import { InviteAgentForm } from "./invite-form";

export const metadata: Metadata = { title: "Agents · Admin" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "free", label: "Free" },
  { id: "expiring", label: "Expiring in 7 days" },
] as const;

export default async function AdminAgentsPage({ searchParams }: PageProps<"/admin/agents">) {
  const { q, filter: rawFilter } = await searchParams;
  const search = typeof q === "string" ? q : "";
  const filter = FILTERS.find((f) => f.id === rawFilter)?.id ?? "all";

  const now = new Date();
  const weekAhead = now.getTime() + 7 * 86_400_000;
  const agents = (await listAgents(search)).filter((a) => {
    const eff = effectivePlan(a, now);
    if (filter === "paid") return eff !== "free";
    if (filter === "free") return eff === "free";
    if (filter === "expiring") return eff !== "free" && a.plan_expires_at && new Date(a.plan_expires_at).getTime() <= weekAhead;
    return true;
  });

  return (
    <>
      <PageHeader title="Agents" description="Agents normally register themselves. Use invitations only when needed." />

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold">Invite an agent</h2>
        <InviteAgentForm />
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={{ pathname: "/admin/agents", query: { ...(search && { q: search }), filter: f.id } }}
              className={cx(
                "rounded-full px-3 py-1 text-sm",
                f.id === filter ? "bg-brand-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action="/admin/agents">
          <input type="hidden" name="filter" value={filter} />
          <Input name="q" defaultValue={search} placeholder="Search name or email" aria-label="Search agents" className="w-64" />
        </form>
      </div>

      {agents.length === 0 ? (
        <EmptyState>No agents match.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-zinc-50">
            <tr>
              <Th>Name</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <Th>Expires</Th>
              <Th>Joined</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {agents.map((a) => {
              const eff = effectivePlan(a, now);
              const lapsed = a.plan !== "free" && eff === "free";
              return (
                <tr key={a.id}>
                  <Td>
                    <p className="font-medium text-zinc-900">
                      {a.name || "—"}
                      {a.role === "admin" && <Badge className="ml-2 bg-brand-100 text-brand-700">admin</Badge>}
                    </p>
                    <p className="text-xs text-zinc-500">{a.email || a.phone}</p>
                  </Td>
                  <Td>
                    <PlanBadge plan={eff} />
                    {lapsed && <span className="ml-2 text-xs text-zinc-500">(was {a.plan})</span>}
                  </Td>
                  <Td>{lapsed ? "expired" : a.plan_status}</Td>
                  <Td>{a.plan === "free" ? "—" : formatDate(a.plan_expires_at)}</Td>
                  <Td>{formatDate(a.created_at)}</Td>
                  <Td className="text-right">
                    <Link href={`/admin/agents/${a.id}`} className="font-medium text-brand-600 hover:underline">
                      Manage
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
