import { Lightbulb } from "lucide-react";

import { DisclaimerNote } from "@/components/shared/disclaimer-note";
import { InsightCard } from "@/components/shared/insight-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Insight } from "@/lib/insights";

export interface InsightsPanelProps {
  insights: Insight[];
}

const MAX_INSIGHTS = 4;

/** Educational insights built from the couple's visible numbers. */
export function InsightsPanel({ insights }: InsightsPanelProps) {
  const shown = insights.slice(0, MAX_INSIGHTS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights for you two</CardTitle>
        <CardDescription>
          Educational patterns from the numbers you both share — every card
          shows how it was calculated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {shown.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
            <Lightbulb
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              Insights appear as you add income, expenses, budgets, and goals.
              Nothing to flag yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((insight) => (
              <InsightCard
                key={insight.id}
                title={insight.title}
                body={insight.body}
                tone={insight.tone}
                assumption={insight.assumption}
              />
            ))}
          </div>
        )}
        <DisclaimerNote />
      </CardContent>
    </Card>
  );
}
