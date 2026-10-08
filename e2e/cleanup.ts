import { E2E_EMAIL, svc } from "./support";

/** Deletes every e2e.*@example.com user and the audit/notification rows they caused. */
export async function cleanupE2EData() {
  const s = svc();
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    ids.push(...data.users.filter((u) => E2E_EMAIL.test(u.email ?? "")).map((u) => u.id));
    if (data.users.length < 1000) break;
  }
  if (!ids.length) return 0;

  const { data: payments } = await s.from("payments").select("id").in("agent_id", ids);
  const paymentIds = (payments ?? []).map((p) => p.id);
  const entityIds = [...ids, ...paymentIds];

  // Rows that would otherwise outlive the users (actor_id is set null on delete).
  await s.from("audit_logs").delete().in("actor_id", ids);
  await s.from("audit_logs").delete().in("entity_id", entityIds);
  if (paymentIds.length) {
    await s.from("notifications").delete().in("link", paymentIds.map((id) => `/admin/payments/${id}`));
  }
  for (const id of ids) {
    const { error } = await s.auth.admin.deleteUser(id);
    if (error) console.warn(`could not delete e2e user ${id}: ${error.message}`);
  }
  // Files uploaded by e2e agents: {agent}/{payment}.ext and {agent}/{listing}/{photo}.ext
  for (const id of ids) {
    const { data: files } = await s.storage.from("payment-screenshots").list(id);
    if (files?.length) await s.storage.from("payment-screenshots").remove(files.map((f) => `${id}/${f.name}`));
    const { data: folders } = await s.storage.from("listing-photos").list(id);
    for (const folder of folders ?? []) {
      const { data: photos } = await s.storage.from("listing-photos").list(`${id}/${folder.name}`);
      if (photos?.length) await s.storage.from("listing-photos").remove(photos.map((p) => `${id}/${folder.name}/${p.name}`));
    }
  }
  return ids.length;
}
