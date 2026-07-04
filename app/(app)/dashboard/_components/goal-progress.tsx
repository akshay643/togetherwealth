import Link from "next/link";
import { Target } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ProgressStat } from "@/components/shared/progress-stat";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { Button } from "@/components/ui/button";
import { ROUTES, type Visibility } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export interface GoalProgressRow {
  id: string;
  name: string;
  emoji: string | null;
  contributed: number;
  target: number;
  targetDate: string | null;
  visibility: Visibility;
  /** True when this is the current user's private goal (shown only to them). */
  isMinePrivate: boolean;
}

export interface GoalProgressProps {
  goals: GoalProgressRow[];
  currency: string;
}

/** Top active goals by target date, each with a calm progress bar. */
export function GoalProgress({ goals, currency }: GoalProgressProps) {
  if (goals.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No active goals"
        description="Set a shared goal — a trip, a home, a cushion — and track it together."
        className="border-0 py-6 sm:py-8"
        action={
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href={ROUTES.goals}>Create a goal</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <div key={goal.id} className="space-y-1">
          <ProgressStat
            label={goal.emoji ? `${goal.emoji} ${goal.name}` : goal.name}
            current={goal.contributed}
            target={goal.target}
            currency={currency}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : "No target date"}
            </span>
            {goal.isMinePrivate ? (
              <VisibilityBadge visibility={goal.visibility} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
