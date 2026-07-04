import Link from "next/link";
import { NotebookPen } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ROUTES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export interface BudgetSnapshotRow {
  id: string;
  label: string;
  spent: number;
  budget: number;
}

export interface BudgetSnapshotProps {
  rows: BudgetSnapshotRow[];
  currency: string;
}

/** Top budget categories this month: spent vs planned as calm mini bars. */
export function BudgetSnapshot({ rows, currency }: BudgetSnapshotProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No budgets this month"
        description="Set a few category budgets to see how spending compares to plan."
        className="border-0 py-6 sm:py-8"
        action={
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href={ROUTES.budgets}>Create a budget</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const ratio = row.budget > 0 ? row.spent / row.budget : 0;
        const abovePlan = row.spent > row.budget;
        return (
          <div key={row.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">{row.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatCurrency(row.spent, { currency })}{" "}
                <span className="text-muted-foreground/70">of</span>{" "}
                {formatCurrency(row.budget, { currency })}
              </span>
            </div>
            <Progress
              value={Math.min(ratio, 1) * 100}
              aria-label={`${row.label}: ${formatCurrency(row.spent, { currency })} of ${formatCurrency(row.budget, { currency })}`}
              className={
                abovePlan ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : undefined
              }
            />
            {abovePlan ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                A little above plan — worth a quick look together.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
