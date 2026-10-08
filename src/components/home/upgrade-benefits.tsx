import type { Plan } from "@/lib/database.types";
import { formatPHP } from "@/lib/format";
import { ButtonLink, Card, cx } from "@/components/ui";

// "Why upgrade" section for the homepage. Built only from what the plans table
// actually enforces: the three usage limits and the AI buyer chat flag.

type LimitKey = "max_active_listings" | "max_leads_per_month" | "max_ai_generations_per_month";

const LIMITS: { key: LimitKey; label: string; unit: string; why: string }[] = [
  {
    key: "max_active_listings",
    label: "Active listings",
    unit: "active listings",
    why: "Post your whole inventory, not just your top five.",
  },
  {
    key: "max_leads_per_month",
    label: "Leads per month",
    unit: "leads a month",
    why: "Keep collecting inquiries in a busy month without hitting a wall.",
  },
  {
    key: "max_ai_generations_per_month",
    label: "AI generations per month",
    unit: "AI generations a month",
    why: "Write listings, Facebook captions and lead summaries with AI every day.",
  },
];

function hasAiChat(plan: Plan): boolean {
  return (plan.features as Record<string, unknown> | null)?.aiChat === true;
}

function cell(n: number | null) {
  return n === null ? "No fixed limit" : n.toLocaleString();
}

function benefits(plan: Plan, free: Plan | undefined): string[] {
  const out = LIMITS.map(({ key, unit }) => {
    const n = plan[key];
    if (n === null) return `No fixed limit on ${unit.replace(" a month", "")} (fair use)`;
    const base = free?.[key];
    const times = base ? Math.round(n / base) : 0;
    return `${n.toLocaleString()} ${unit}${times > 1 ? `, ${times}× the Free plan` : ""}`;
  });
  if (hasAiChat(plan) && !(free && hasAiChat(free))) {
    out.push("AI assistant answers buyers on your listing pages 24/7 and saves them as leads");
  }
  return out;
}

export function UpgradeBenefits({ plans, signedIn }: { plans: Plan[]; signedIn: boolean }) {
  const free = plans.find((p) => p.price_centavos === 0);
  const paid = plans.filter((p) => p.price_centavos > 0);
  if (paid.length === 0) return null;
  // Hidden until the aiChat flag exists (migration 20261010000002).
  const showChat = plans.some(hasAiChat);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        {paid.map((plan) => {
          const featured = plan.id === "pro";
          return (
            <Card key={plan.id} className={cx("flex flex-col", featured && "border-brand-500 ring-1 ring-brand-500")}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold">Upgrade to {plan.name}</h3>
                <p>
                  <span className="text-2xl font-bold">{formatPHP(plan.price_centavos)}</span>
                  <span className="text-sm text-zinc-500"> / {plan.billing_period_days} days</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-zinc-600">{plan.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-700">
                {benefits(plan, free).map((b) => (
                  <li key={b} className="flex gap-2">
                    <span aria-hidden className="text-brand-500">
                      ✓
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={signedIn ? `/payment?plan=${plan.id}` : "/register"}
                variant={featured ? "primary" : "secondary"}
                className="mt-6 w-full"
              >
                {signedIn ? `Upgrade to ${plan.name}` : "Start free, upgrade anytime"}
              </ButtonLink>
            </Card>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <caption className="sr-only">Plan comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                What you get
              </th>
              {plans.map((p) => (
                <th key={p.id} scope="col" className="px-4 py-3 text-center font-semibold">
                  {p.name}
                  <span className="block text-xs font-normal text-zinc-500">
                    {p.price_centavos > 0 ? `${formatPHP(p.price_centavos)} / ${p.billing_period_days} days` : "Free"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {LIMITS.map(({ key, label, why }) => (
              <tr key={key}>
                <th scope="row" className="px-4 py-3 text-left font-medium text-zinc-800">
                  {label}
                  <span className="block text-xs font-normal text-zinc-500">{why}</span>
                </th>
                {plans.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center text-zinc-700">
                    {cell(p[key])}
                  </td>
                ))}
              </tr>
            ))}
            {showChat && (
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium text-zinc-800">
                  AI buyer chat on listing pages
                  <span className="block text-xs font-normal text-zinc-500">
                    Answers buyer questions and captures their contact details.
                  </span>
                </th>
                {plans.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    {hasAiChat(p) ? (
                      <span className="font-semibold text-emerald-600">✓ Included</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-center text-xs text-zinc-500">
        Paid plans run for 30 days, are paid via GCash, and activate once we confirm your payment, usually within one
        business day. Your listings and leads stay when you upgrade.
      </p>
    </div>
  );
}
