import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}

const TREND_META = {
  up: {
    icon: ArrowUpRight,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  down: {
    icon: ArrowDownRight,
    className: "text-amber-600 dark:text-amber-400",
  },
  flat: {
    icon: Minus,
    className: "text-muted-foreground",
  },
} as const;

/** Dashboard metric card: label, big tabular-nums value, optional hint + trend. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  const trendMeta = trend ? TREND_META[trend.direction] : null;
  const TrendIcon = trendMeta?.icon;

  return (
    <Card className={cn("gap-2 px-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {trend && trendMeta && TrendIcon ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              trendMeta.className
            )}
          >
            <TrendIcon aria-hidden className="size-3.5" />
            {trend.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
