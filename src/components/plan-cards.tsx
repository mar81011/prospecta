import type { Plan } from "@/lib/database.types";
import { planFeatures } from "@/lib/plans/entitlements";
import { formatPHP } from "@/lib/format";
import { ButtonLink, Card, cx } from "@/components/ui";

const LEVEL_LABEL: Record<string, string> = {
  none: "Not included",
  basic: "Basic",
  standard: "Included",
  full: "Full",
  advanced: "Advanced",
};

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
        const rows = [
          limit(plan.max_active_listings, "active listings"),
          limit(plan.max_leads_per_month, "leads / month"),
          limit(plan.max_ai_generations_per_month, "AI generations / month"),
          `Lead management: ${LEVEL_LABEL[f.leadManagement]}${f.advancedCrm ? " + Advanced CRM" : ""}`,
          `Lead scoring: ${LEVEL_LABEL[f.leadScoring]}`,
          `Property AI tools: ${LEVEL_LABEL[f.propertyAiTools]}`,
          `Site-viewing management: ${LEVEL_LABEL[f.siteViewing]}`,
          `Messenger: ${f.messengerAutomation ? "Advanced AI automation" : LEVEL_LABEL[f.messenger]}`,
          `Property matching: ${LEVEL_LABEL[f.propertyMatching]}`,
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
            <ul className="mb-6 flex-1 space-y-2 text-sm text-zinc-700">
              {rows.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-brand-500">
                    ✓
                  </span>
                  {r}
                </li>
              ))}
            </ul>
            {cta}
          </Card>
        );
      })}
    </div>
  );
}
