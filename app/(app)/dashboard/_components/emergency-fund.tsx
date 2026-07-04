import Link from "next/link";
import { Umbrella } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ProgressStat } from "@/components/shared/progress-stat";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export interface EmergencyFundProps {
  hasGoal: boolean;
  balance: number;
  essentialsMonthly: number;
  coverageMonths: number;
  currency: string;
}

const TARGET_MONTHS = 3;

/** Emergency fund coverage: progress toward a 3-month cushion of essentials. */
export function EmergencyFund({
  hasGoal,
  balance,
  essentialsMonthly,
  coverageMonths,
  currency,
}: EmergencyFundProps) {
  if (!hasGoal) {
    return (
      <EmptyState
        icon={Umbrella}
        title="No emergency fund yet"
        description="A cushion for surprises is a calm place to start saving together."
        className="border-0 py-6 sm:py-8"
        action={
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href={ROUTES.emergencyFund}>Start an emergency fund</Link>
          </Button>
        }
      />
    );
  }

  const months = Math.round(coverageMonths * 10) / 10;

  if (essentialsMonthly <= 0) {
    return (
      <div className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(balance, { currency })}
        </p>
        <p className="text-sm text-muted-foreground">
          saved so far. Once some essential expenses are recorded, we&apos;ll
          estimate how many months this covers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ProgressStat
        label={`${TARGET_MONTHS}-month cushion`}
        current={balance}
        target={essentialsMonthly * TARGET_MONTHS}
        currency={currency}
      />
      <p className="text-sm text-muted-foreground">
        Covers about{" "}
        <span className="font-medium text-foreground tabular-nums">
          {months} {months === 1 ? "month" : "months"}
        </span>{" "}
        of essentials ({formatCurrency(essentialsMonthly, { currency })}/mo
        averaged over the last 3 months).
      </p>
    </div>
  );
}
