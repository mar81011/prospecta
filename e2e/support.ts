import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { expect, test as base, type Page } from "@playwright/test";
import type { Database } from "../src/lib/database.types";

loadEnvConfig(process.cwd());

export const E2E_EMAIL = /^e2e\.[a-z0-9.-]+@example\.com$/;
export const E2E_GCASH = { number: "0917 555 0101", name: "Prospecta E2E" };

export function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; password: string; name: string };

const rand = () => randomBytes(4).toString("hex");

/** Confirmed user created through the admin API (no email is sent). */
export async function createUser(opts: { role?: "agent" | "admin"; name?: string } = {}): Promise<TestUser> {
  const s = svc();
  const role = opts.role ?? "agent";
  const email = `e2e.${role}.${rand()}@example.com`;
  const password = `Pw-${rand()}-${rand()}`;
  const name = opts.name ?? `E2E ${role === "admin" ? "Admin" : "Agent"} ${rand()}`;
  const { data, error } = await s.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  if (role === "admin") {
    const { error: e } = await s.from("profiles").update({ role: "admin" } as never).eq("id", data.user.id);
    if (e) throw new Error(`promote failed: ${e.message}`);
  }
  return { id: data.user.id, email, password, name };
}

/** Unique 13-digit GCash-style reference. */
export function gcashRef(): string {
  return `9${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 900 + 100)}`;
}

export async function login(page: Page, user: TestUser, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Visible form alerts (Next.js also renders a hidden role="alert" route announcer). */
export const alertBox = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

/** Submit a GCash payment through the UI. */
export async function submitPayment(page: Page, plan: "starter" | "pro", ref = gcashRef(), screenshot?: Buffer) {
  await page.goto(`/payment?plan=${plan}`);
  await page.getByRole("button", { name: "I've paid" }).click();
  await page.getByLabel("GCash reference number").fill(ref);
  if (screenshot) {
    await page.getByLabel("Screenshot (optional)").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: screenshot });
  }
  await page.getByRole("button", { name: "Submit payment" }).click();
  await page.waitForURL("**/payment/pending**");
  return ref;
}

export async function paymentIdFor(agentId: string, status = "PENDING") {
  const { data } = await svc()
    .from("payments")
    .select("id")
    .eq("agent_id", agentId)
    .eq("status", status as never)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();
  return data!.id;
}

// 1x1 transparent PNG.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

type Fixtures = { agent: TestUser; admin: TestUser };

export const test = base.extend<Fixtures>({
  // Playwright passes the fixture callback as `use`; renamed so the React hooks lint rule ignores it.
  agent: async ({}, provide) => provide(await createUser()),
  admin: async ({}, provide) => provide(await createUser({ role: "admin" })),
});

export { expect };
