"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  CheckSquare,
  CreditCard,
  FileText,
  Gem,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  MessagesSquare,
  Receipt,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = { title: string; href: string; icon: LucideIcon };

const PRIMARY_TABS: NavItem[] = [
  { title: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
  { title: "Expenses", href: ROUTES.expenses, icon: Receipt },
  { title: "Goals", href: ROUTES.goals, icon: Target },
  { title: "Check-ins", href: ROUTES.checkins, icon: MessagesSquare },
];

const MORE_ITEMS: NavItem[] = [
  { title: "Net worth", href: ROUTES.netWorth, icon: Scale },
  { title: "Cash flow", href: ROUTES.cashFlow, icon: ArrowLeftRight },
  { title: "Activity", href: ROUTES.activity, icon: Activity },
  { title: "Budgets", href: ROUTES.budgets, icon: Wallet },
  { title: "Debts", href: ROUTES.debts, icon: CreditCard },
  { title: "Emergency fund", href: ROUTES.emergencyFund, icon: ShieldCheck },
  { title: "Couple goals", href: ROUTES.coupleGoals, icon: Heart },
  { title: "Investments", href: ROUTES.investments, icon: TrendingUp },
  { title: "Research", href: ROUTES.research, icon: BookOpen },
  { title: "Documents", href: ROUTES.documents, icon: FileText },
  { title: "Tasks", href: ROUTES.tasks, icon: CheckSquare },
  { title: "Settings", href: ROUTES.settings, icon: Settings },
  { title: "Billing", href: ROUTES.billing, icon: Gem },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({
  isPlatformAdmin,
}: {
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const moreItems: NavItem[] = isPlatformAdmin
    ? [...MORE_ITEMS, { title: "Admin", href: ROUTES.admin, icon: ShieldAlert }]
    : MORE_ITEMS;

  const moreIsActive = moreItems.some((item) =>
    isActivePath(pathname, item.href)
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {PRIMARY_TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="size-5" strokeWidth={active ? 2.25 : 2} />
              <span>{tab.title}</span>
            </Link>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              moreIsActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[75svh] overflow-y-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <SheetHeader className="pb-0">
              <SheetTitle className="text-left">More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-2">
              {moreItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-medium transition-colors",
                      active
                        ? "border-primary/30 bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="size-5" />
                    <span className="leading-tight">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
