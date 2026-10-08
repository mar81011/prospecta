export type FormState = { error?: string; message?: string };
export const initialFormState: FormState = {};

/** Only allow same-site relative redirects. */
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
