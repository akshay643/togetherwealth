import type { LucideIcon } from "lucide-react";
import { ChevronDown, CircleAlert, Lightbulb, TrendingUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface InsightCardProps {
  title: string;
  body: string;
  tone?: "positive" | "neutral" | "attention";
  icon?: LucideIcon;
  assumption?: string;
  className?: string;
}

const TONE_META: Record<
  NonNullable<InsightCardProps["tone"]>,
  { icon: LucideIcon; iconClass: string; iconWrapClass: string }
> = {
  positive: {
    icon: TrendingUp,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    iconWrapClass: "bg-emerald-500/10",
  },
  neutral: {
    icon: Lightbulb,
    iconClass: "text-primary",
    iconWrapClass: "bg-primary/10",
  },
  attention: {
    icon: CircleAlert,
    iconClass: "text-amber-600 dark:text-amber-400",
    iconWrapClass: "bg-amber-500/10",
  },
};

/**
 * Calm insight tile. When `assumption` is provided it renders as an
 * expandable "How this is calculated" section so the math stays transparent.
 */
export function InsightCard({
  title,
  body,
  tone = "neutral",
  icon,
  assumption,
  className,
}: InsightCardProps) {
  const meta = TONE_META[tone];
  const Icon = icon ?? meta.icon;

  return (
    <div
      className={cn(
        "rounded-lg bg-card p-4 ring-1 ring-foreground/10",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            meta.iconWrapClass
          )}
        >
          <Icon className={cn("size-4", meta.iconClass)} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm leading-tight font-medium">{title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
      {assumption ? (
        <Collapsible className="mt-3 border-t pt-2">
          <CollapsibleTrigger className="group/insight flex min-h-8 w-full items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ChevronDown
              aria-hidden
              className="size-3.5 transition-transform group-data-[state=open]/insight:rotate-180"
            />
            How this is calculated
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="pt-1 pb-1 pl-4.5 text-xs leading-relaxed text-muted-foreground">
              {assumption}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
