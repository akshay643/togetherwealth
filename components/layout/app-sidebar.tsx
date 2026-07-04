"use client";

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
  HeartHandshake,
  LayoutDashboard,
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

import { APP_NAME, ROUTES } from "@/lib/constants";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
      { title: "Net worth", href: ROUTES.netWorth, icon: Scale },
      { title: "Cash flow", href: ROUTES.cashFlow, icon: ArrowLeftRight },
      { title: "Activity", href: ROUTES.activity, icon: Activity },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Expenses", href: ROUTES.expenses, icon: Receipt },
      { title: "Budgets", href: ROUTES.budgets, icon: Wallet },
      { title: "Debts", href: ROUTES.debts, icon: CreditCard },
      { title: "Emergency fund", href: ROUTES.emergencyFund, icon: ShieldCheck },
    ],
  },
  {
    label: "Grow",
    items: [
      { title: "Goals", href: ROUTES.goals, icon: Target },
      { title: "Couple goals", href: ROUTES.coupleGoals, icon: Heart },
      { title: "Investments", href: ROUTES.investments, icon: TrendingUp },
    ],
  },
  {
    label: "Together",
    items: [
      { title: "Research", href: ROUTES.research, icon: BookOpen },
      { title: "Check-ins", href: ROUTES.checkins, icon: MessagesSquare },
      { title: "Documents", href: ROUTES.documents, icon: FileText },
      { title: "Tasks", href: ROUTES.tasks, icon: CheckSquare },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  workspaceName,
  isPlatformAdmin,
}: {
  workspaceName: string;
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const closeMobile = () => setOpenMobile(false);

  const footerItems: NavItem[] = [
    { title: "Settings", href: ROUTES.settings, icon: Settings },
    { title: "Billing", href: ROUTES.billing, icon: Gem },
    ...(isPlatformAdmin
      ? [{ title: "Admin", href: ROUTES.admin, icon: ShieldAlert }]
      : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={APP_NAME}>
              <Link href={ROUTES.dashboard} onClick={closeMobile}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <HeartHandshake className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold tracking-tight">
                    {APP_NAME}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {workspaceName}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href} onClick={closeMobile}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {footerItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, item.href)}
                tooltip={item.title}
              >
                <Link href={item.href} onClick={closeMobile}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
