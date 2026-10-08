import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { listAuditLogs } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log · Admin" };

const PAGE_SIZE = 50;

function entityLink(type: string, id: string | null) {
  if (!id) return null;
  if (type === "payment") return `/admin/payments/${id}`;
  if (type === "profile") return `/admin/agents/${id}`;
  return null;
}

export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const { page: raw } = await searchParams;
  const page = Math.max(0, Number.parseInt(typeof raw === "string" ? raw : "0", 10) || 0);
  const { rows, total } = await listAuditLogs(page, PAGE_SIZE);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <>
      <PageHeader title="Audit log" description="Every payment, plan, role and settings change. Entries cannot be edited." />
      {rows.length === 0 ? (
        <EmptyState>No activity yet.</EmptyState>
      ) : (
        <Table>
          <thead className="bg-zinc-50">
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const href = entityLink(r.entity_type, r.entity_id);
              return (
                <tr key={r.id} className="align-top">
                  <Td>{formatDateTime(r.created_at)}</Td>
                  <Td>{r.actor ? r.actor.name || r.actor.email : <span className="text-zinc-400">system</span>}</Td>
                  <Td className="font-mono text-xs">{r.action}</Td>
                  <Td className="text-xs">
                    {href ? (
                      <Link href={href} className="text-brand-600 hover:underline">
                        {r.entity_type}
                      </Link>
                    ) : (
                      r.entity_type
                    )}
                  </Td>
                  <Td className="max-w-md whitespace-pre-wrap break-all font-mono text-xs text-zinc-500">
                    {JSON.stringify(r.metadata)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {lastPage > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 0 ? (
            <Link href={`/admin/audit-logs?page=${page - 1}`} className="text-brand-600 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">
            Page {page + 1} of {lastPage + 1}
          </span>
          {page < lastPage ? (
            <Link href={`/admin/audit-logs?page=${page + 1}`} className="text-brand-600 hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </>
  );
}
