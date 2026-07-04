import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, CircleCheckBig } from "lucide-react";

export interface NextAction {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export interface NextActionsProps {
  actions: NextAction[];
}

/** Rule-based "what to do next" list. Calm, one tap per suggestion. */
export function NextActions({ actions }: NextActionsProps) {
  if (actions.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
        <CircleCheckBig
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        <p className="text-sm text-muted-foreground">
          You&apos;re all caught up — nothing needs your attention right now.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.key}>
            <Link
              href={action.href}
              className="group flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
              >
                <Icon className="size-4 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {action.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
