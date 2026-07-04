"use client";

import { useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency, formatPercent } from "@/lib/format";

export interface AllocationSlice {
  /** Stable key (asset class), used for color + tooltip identity. */
  key: string;
  label: string;
  value: number;
}

export interface AllocationDonutProps {
  /** Pre-aggregated, sorted largest-first; at most 5 slices. */
  slices: AllocationSlice[];
  currency: string;
}

/**
 * Donut of visible holdings by asset class. Hues come from the theme's
 * fixed chart palette in slice order (never cycled); the legend repeats
 * every label + exact value in text so identity never relies on color.
 */
export function AllocationDonut({ slices, currency }: AllocationDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const { config, colored } = useMemo(() => {
    const config: ChartConfig = {};
    const colored = slices.map((s, i) => ({
      ...s,
      color: `var(--chart-${Math.min(i + 1, 5)})`,
    }));
    for (const s of colored) {
      config[s.key] = { label: s.label, color: s.color };
    }
    return { config, colored };
  }, [slices]);

  if (total <= 0) return null;

  return (
    <div>
      <ChartContainer
        config={config}
        className="mx-auto aspect-square h-44 w-full max-w-56"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name, item) => {
                  const fill = (
                    item as unknown as { payload?: { fill?: string } }
                  ).payload?.fill;
                  const label =
                    colored.find((s) => s.key === String(name))?.label ??
                    String(name);
                  return (
                    <div className="flex w-full min-w-32 items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: fill }}
                      />
                      <span className="text-muted-foreground">{label}</span>
                      <span className="ml-auto font-medium text-foreground tabular-nums">
                        {formatCurrency(Number(value), { currency })}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={colored}
            dataKey="value"
            nameKey="key"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
            cornerRadius={3}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {colored.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                  return null;
                }
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-base font-semibold tabular-nums"
                    >
                      {formatCurrency(total, { currency, compact: true })}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 18}
                      className="fill-muted-foreground text-[10px]"
                    >
                      Total value
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="mt-4 space-y-1.5" aria-label="Allocation by asset class">
        {colored.map((s) => (
          <li
            key={s.key}
            className="flex min-h-6 items-center gap-2 text-sm"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 truncate">{s.label}</span>
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              {formatCurrency(s.value, { currency, compact: true })}
              <span className="text-muted-foreground/70">
                {" "}
                · {formatPercent(s.value / total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
