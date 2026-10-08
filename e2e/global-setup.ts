import { writeFileSync, mkdirSync } from "node:fs";
import { cleanupE2EData } from "./cleanup";
import { E2E_GCASH, svc } from "./support";

export const SNAPSHOT = "e2e/.state/snapshot.json";

export default async function globalSetup() {
  const s = svc();
  await cleanupE2EData(); // leftovers from an aborted run

  // Snapshot what tests may change, so teardown can restore it.
  const [{ data: settings }, { data: plans }] = await Promise.all([
    s.from("app_settings").select("*").single(),
    s.from("plans").select("*"),
  ]);
  mkdirSync("e2e/.state", { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify({ settings, plans }, null, 2));

  // Tests need GCash details for the payment page.
  if (!settings?.gcash_number) {
    await s
      .from("app_settings")
      .update({ gcash_number: E2E_GCASH.number, gcash_account_name: E2E_GCASH.name } as never)
      .eq("id", true);
  }
}
