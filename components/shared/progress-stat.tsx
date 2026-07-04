import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ProgressStatProps {
  label: string;
  current: number;
  target: number;
  currency?: string;
  className?: string;
}

/** Labeled progress bar with "x of y" amounts and a percent readout. */
export function ProgressStat({
  label,
  current,
  target,
  currency = "USD",
  className,
}: ProgressStatProps) {
  const ratio = target > 0 ? current / target : 0;
  const barValue = Math.min(Math.max(ratio, 0), 1) * 100;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatPercent(ratio)}
        </span>
      </div>
      <Progress
        value={barValue}
        aria-label={`${label}: ${formatPercent(ratio)} of target`}
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatCurrency(current, { currency })}{" "}
        <span className="text-muted-foreground/70">of</span>{" "}
        {formatCurrency(target, { currency })}
      </p>
    </div>
  );
}
