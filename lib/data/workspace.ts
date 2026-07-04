import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { ROUTES, type Plan } from "@/lib/constants";
import { getDemoWorkspaceContext } from "@/lib/demo-data";
import { DEMO_SESSION_COOKIE, demoEnabled } from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/server";
import type {
  CoupleWorkspace,
  Profile,
  Subscription,
  WorkspaceMember,
  WorkspaceMemberWithProfile,
} from "@/lib/types/database";

/**
 * Everything a feature page needs to know about the signed-in user and
 * their couple workspace. Loaded once per request (React cache).
 */
export type WorkspaceContext = {
  user: User;
  profile: Profile;
  workspace: CoupleWorkspace;
  membership: WorkspaceMember;
  members: WorkspaceMemberWithProfile[];
  partner: Profile | null;
  plan: Plan;
  subscription: Subscription | null;
  isDemo?: boolean;
};

/**
 * Load the current user's workspace context.
 *
 * - No authenticated user → redirect to /login.
 * - No workspace membership yet, or onboarding not complete → returns null
 *   (callers should send the user to onboarding — see requireWorkspace).
 */
export const getWorkspaceContext = cache(
  async (): Promise<WorkspaceContext | null> => {
    const cookieStore = await cookies();
    if (
      demoEnabled() &&
      cookieStore.get(DEMO_SESSION_COOKIE)?.value === "1"
    ) {
      return getDemoWorkspaceContext();
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(ROUTES.login);

    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("workspace_members")
        .select("*")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!profile || !membership || !profile.onboarding_complete) {
      return null;
    }

    const [{ data: workspace }, { data: memberRows }, { data: subscription }] =
      await Promise.all([
        supabase
          .from("couple_workspaces")
          .select("*")
          .eq("id", membership.workspace_id)
          .maybeSingle(),
        supabase
          .from("workspace_members")
          .select("*")
          .eq("workspace_id", membership.workspace_id)
          .order("joined_at", { ascending: true }),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("workspace_id", membership.workspace_id)
          .maybeSingle(),
      ]);

    if (!workspace) return null;

    const memberList = memberRows ?? [];
    const memberIds = memberList.map((m) => m.user_id);
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", memberIds);

    const profilesById = new Map<string, Profile>(
      (memberProfiles ?? []).map((p) => [p.id, p])
    );
    // Make sure the current user's profile is present even if the profiles
    // query was restricted.
    profilesById.set(profile.id, profile);

    const members: WorkspaceMemberWithProfile[] = memberList.flatMap((m) => {
      const memberProfile = profilesById.get(m.user_id);
      return memberProfile ? [{ ...m, profile: memberProfile }] : [];
    });

    const partner =
      members.find((m) => m.user_id !== user.id)?.profile ?? null;

    return {
      user,
      profile,
      workspace,
      membership,
      members,
      partner,
      plan: subscription?.plan ?? "free",
      subscription: subscription ?? null,
    };
  }
);

/**
 * Like getWorkspaceContext, but guarantees a workspace: users without one
 * (or who haven't finished onboarding) are redirected to onboarding.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect(ROUTES.onboarding);
  return ctx;
}
