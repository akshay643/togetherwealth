import { requireWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireWorkspace();
  const supabase = await createClient();

  const [{ data: notifications }, { count: unreadCount }] = ctx.isDemo
    ? [{ data: [] }, { count: 0 }]
    : await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", ctx.user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", ctx.user.id)
          .eq("is_read", false),
      ]);

  return (
    <SidebarProvider>
      <AppSidebar
        workspaceName={ctx.workspace.name}
        isPlatformAdmin={ctx.profile.is_platform_admin}
      />
      <div className="relative flex min-h-svh w-full flex-1 flex-col bg-background">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <SidebarTrigger className="-ml-1.5" />
          <Separator orientation="vertical" className="hidden !h-4 md:block" />
          <span className="truncate text-sm text-muted-foreground">
            {ctx.workspace.name}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell
              userId={ctx.user.id}
              initialNotifications={notifications ?? []}
              initialUnreadCount={unreadCount ?? 0}
            />
            <UserMenu
              fullName={ctx.profile.full_name}
              email={ctx.profile.email}
              avatarUrl={ctx.profile.avatar_url}
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">
          {children}
        </main>
        <MobileBottomNav isPlatformAdmin={ctx.profile.is_platform_admin} />
      </div>
    </SidebarProvider>
  );
}
