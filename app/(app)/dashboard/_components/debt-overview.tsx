import Link from "next/link";
import { CreditCard } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

export interface DebtOverviewProps {
  totalBalance: number;
  debtCount: number;
  nextPayment: { label: string; amount: number; dueDate: Date } | null;
  currency: string;
}

/** Total active debt balance plus the next payment coming up. */
export function DebtOverview({
  totalBalance,
  debtCount,
  nextPayment,
  currency,
}: DebtOverviewProps) {
  if (debtCount === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No active debts"
        description="Nothing tracked here right now. Add a debt to plan payoff together."
        className="border-0 py-6 sm:py-8"
        action={
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href={ROUTES.debts}>Track a debt</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(totalBalance, { currency })}
        </p>
        <p className="text-xs text-muted-foreground">
          across {debtCount} active {debtCount === 1 ? "debt" : "debts"}
        </p>
      </div>
      {nextPayment ? (
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Next payment
          </p>
          <p className="mt-0.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{nextPayment.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatCurrency(nextPayment.amount, { currency })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(nextPayment.dueDate)}
          </p>
        </div>
      ) : null}
      <Button asChild variant="ghost" size="sm" className="-ml-2 max-md:h-11">
        <Link href={ROUTES.debts}>View payoff plan</Link>
      </Button>
    </div>
  );
}
