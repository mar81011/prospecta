import type { Plan } from "@/lib/database.types";
import { planFeatures } from "@/lib/plans/entitlements";
import { formatPHP } from "@/lib/format";
import { ButtonLink, Card, cx } from "@/components/ui";

// Only list what the app actually does today. Planned features are shown as
// "coming soon" so the cards never promise something that isn't there.
const EVERY_PLAN = [
  "Public listing pages with Facebook sharing",
  "Your own agent page with Call, Messenger and Viber buttons",
  "Lead pipeline with lead scoring and site-viewing reminders",
  "Listing stats: views and contact taps",
];

function limit(n: number | null, unit: string) {
  return n === null ? `High / unlimited ${unit} (fair use)` : `${n.toLocaleString()} ${unit}`;
}

export function PlanCards({
  plans,
  currentPlan,
  signedIn,
}: {
  plans: Plan[];
  /** The plan the agent is entitled to right now, if signed in. */
  currentPlan?: string;
  signedIn: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const f = planFeatures(plan);
        const isCurrent = currentPlan === plan.id;
        const featured = plan.id === "pro";
        const aiChat = (plan.features as Record<string, unknown> | null)?.aiChat === true;
        const rows = [
          limit(plan.max_active_listings, "active listings"),
          limit(plan.max_leads_per_month, "leads / month"),
          limit(plan.max_ai_generations_per_month, "AI generations / month"),
          ...(aiChat ? ["AI assistant that answers buyers on your listing pages 24/7"] : []),
          ...EVERY_PLAN,
        ];
        const soon = [
          ...(f.propertyMatching !== "none" ? ["Property matching for your leads"] : []),
          ...(f.messengerAutomation ? ["Messenger auto-replies"] : []),
        ];

        let cta;
        if (isCurrent && plan.id === "free") {
          cta = <p className="text-center text-sm font-medium text-zinc-500">Your current plan</p>;
        } else if (plan.id === "free") {
          cta = signedIn ? null : (
            <ButtonLink href="/register" variant="secondary" className="w-full">
              Start free
            </ButtonLink>
          );
        } else {
          const href = `/payment?plan=${plan.id}`;
          cta = (
            <ButtonLink
              href={signedIn ? href : `/register`}
              variant={featured ? "primary" : "secondary"}
              className="w-full"
            >
              {isCurrent ? `Renew ${plan.name}` : `Upgrade to ${plan.name}`}
            </ButtonLink>
          );
        }

        return (
          <Card key={plan.id} className={cx("flex flex-col", featured && "border-brand-500 ring-1 ring-brand-500")}>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-2">
                <span className="text-3xl font-bold">{formatPHP(plan.price_centavos)}</span>
                {plan.price_centavos > 0 && (
                  <span className="text-sm text-zinc-500"> / {plan.billing_period_days} days</span>
                )}
              </p>
              <p className="mt-2 text-sm text-zinc-600">{plan.description}</p>
            </div>
            <ul className="flex-1 space-y-2 text-sm text-zinc-700">
              {rows.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-brand-500">
                    ✓
                  </span>
                  {r}
                </li>
              ))}
            </ul>
            {soon.length > 0 && (
              <div className="mt-4 border-t border-dashed border-zinc-200 pt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Coming soon</p>
                <ul className="space-y-1.5 text-sm text-zinc-500">
                  {soon.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span aria-hidden>○</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6" />
            {cta}
          </Card>
        );
      })}
    </div>
  );
}
