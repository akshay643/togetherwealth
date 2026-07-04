import { CalendarClock, CreditCard, Repeat } from "lucide-react";

import type { UpcomingBill } from "@/lib/insights";
import { formatCurrency, formatDate } from "@/lib/format";

export interface UpcomingBillsProps {
  bills: UpcomingBill[];
  currency: string;
}

const MAX_ROWS = 5;

/** Bills due in the next two weeks: recurring expenses + debt payments. */
export function UpcomingBills({ bills, currency }: UpcomingBillsProps) {
  if (bills.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
        <CalendarClock
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          Nothing due in the next two weeks. We&apos;ll project bills here from
          your recurring expenses and debt due dates.
        </p>
      </div>
    );
  }

  const shown = bills.slice(0, MAX_ROWS);
  const remaining = bills.length - shown.length;
  const total = bills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {shown.map((bill) => {
          const Icon = bill.source === "debt" ? CreditCard : Repeat;
          return (
            <li
              key={bill.id}
              className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5"
            >
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
              >
                <Icon className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{bill.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(bill.dueDate)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatCurrency(bill.amount, { currency })}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t px-2 pt-2 text-xs text-muted-foreground tabular-nums">
        {remaining > 0 ? `+${remaining} more · ` : ""}
        {formatCurrency(total, { currency })} total over the next 14 days
      </p>
    </div>
  );
}
