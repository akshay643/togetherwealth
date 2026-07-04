import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLAN_META, ROUTES, type Plan } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type PlanGateFeature =
  | "checkins"
  | "advancedProjections"
  | "researchExport"
  | "unlimitedGoals";

export interface PlanGateProps {
  plan: Plan;
  requires: PlanGateFeature;
  children: React.ReactNode;
  fallbackTitle?: string;
  className?: string;
}

function planAllows(plan: Plan, requires: PlanGateFeature): boolean {
  const limits = PLAN_META[plan].limits;
  switch (requires) {
    case "checkins":
      return limits.checkins;
    case "advancedProjections":
      return limits.advancedProjections;
    case "researchExport":
      return limits.researchExport;
    case "unlimitedGoals":
      return limits.savingsGoals === null;
  }
}

/** The cheapest plan that unlocks each feature, plus features worth naming. */
const UPGRADE_META: Record<
  PlanGateFeature,
  { plan: Plan; title: string; features: string[] }
> = {
  checkins: {
    plan: "plus",
    title: "Monthly money check-ins are part of Plus",
    features: [
      "Monthly money check-ins",
      "Advanced projections & insights",
      "Unlimited savings goals",
    ],
  },
  advancedProjections: {
    plan: "plus",
    title: "Advanced projections are part of Plus",
    features: [
      "Advanced projections & insights",
      "Debt payoff comparisons",
      "Monthly money check-ins",
    ],
  },
  researchExport: {
    plan: "premium",
    title: "Data export is part of Premium",
    features: ["Advanced research hub", "Data export", "Priority support"],
  },
  unlimitedGoals: {
    plan: "plus",
    title: "Unlimited savings goals are part of Plus",
    features: [
      "Unlimited savings goals",
      "Unlimited documents vault",
      "Monthly money check-ins",
    ],
  },
};

/**
 * Server-safe feature gate. Renders children when the workspace plan allows
 * the feature; otherwise shows a calm upgrade card linking to billing.
 */
export function PlanGate({
  plan,
  requires,
  children,
  fallbackTitle,
  className,
}: PlanGateProps) {
  if (planAllows(plan, requires)) return <>{children}</>;

  const upgrade = UPGRADE_META[requires];
  const targetPlan = PLAN_META[upgrade.plan];

  return (
    <Card
      className={cn(
        "items-center gap-4 px-6 py-8 text-center sm:py-10",
        className
      )}
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-primary/10"
      >
        <Sparkles className="size-5 text-primary" />
      </span>
      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-semibold text-balance">
          {fallbackTitle ?? upgrade.title}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {targetPlan.tagline} — {targetPlan.label} is{" "}
          <span className="tabular-nums">
            ${targetPlan.priceMonthly}/month
          </span>
          .
        </p>
      </div>
      <ul className="space-y-1.5 text-left">
        {upgrade.features.slice(0, 3).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs">
            <Check
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 text-primary"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button asChild size="lg">
        <Link href={ROUTES.billing}>Upgrade to {targetPlan.label}</Link>
      </Button>
    </Card>
  );
}
