import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert, HeartHandshake } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { MoneyStyle } from "@/lib/constants";
import type {
  Profile,
  WorkspaceMember,
} from "@/lib/types/database";
import { OnboardingWizard } from "./_components/onboarding-wizard";
import type {
  WizardInvite,
  WizardProfile,
  WizardWorkspace,
} from "./_components/wizard-constants";

export const metadata: Metadata = { title: "Onboarding" };

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

function fallbackProfile(email: string): WizardProfile {
  return {
    fullName: null,
    email,
    currency: "USD",
    moneyStylePref: null,
    sharePersonalNetWorth: false,
    riskComfort: null,
    stressNotes: null,
    priorities: null,
  };
}

function toWizardProfile(profile: Profile | null, email: string): WizardProfile {
  if (!profile) return fallbackProfile(email);
  return {
    fullName: profile.full_name,
    email: profile.email,
    currency: profile.currency,
    moneyStylePref: profile.money_style_pref,
    sharePersonalNetWorth: profile.share_personal_net_worth,
    riskComfort: profile.risk_comfort,
    stressNotes: profile.financial_stress_notes,
    priorities: profile.priorities,
  };
}

async function loadWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membership: WorkspaceMember | null
): Promise<WizardWorkspace | null> {
  if (!membership) return null;
  const { data: workspace } = await supabase
    .from("couple_workspaces")
    .select("id, name, money_style")
    .eq("id", membership.workspace_id)
    .maybeSingle();

  return workspace
    ? {
        id: workspace.id,
        name: workspace.name,
        role: membership.role,
        moneyStyle: workspace.money_style as MoneyStyle,
      }
    : null;
}

async function loadInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membership: WorkspaceMember | null
): Promise<WizardInvite | null> {
  if (!membership || membership.role !== "owner") return null;

  const { data: invite } = await supabase
    .from("partner_invites")
    .select("token, email")
    .eq("workspace_id", membership.workspace_id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return invite
    ? {
        url: `${appBaseUrl()}${ROUTES.invite(invite.token)}`,
        email: invite.email,
      }
    : null;
}

function OnboardingShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link
          href={ROUTES.home}
          className="mb-8 flex items-center justify-center gap-2.5"
          aria-label={`${APP_NAME} home`}
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartHandshake className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </Link>
        <main>{children}</main>
      </div>
    </div>
  );
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.onboarding)}`);
  }

  const email = user.email ?? "";
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile && !profileError) {
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email,
        full_name:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
      })
      .select("*")
      .maybeSingle();
    profile = inserted;
    profileError = insertError;
  }

  if (profile?.onboarding_complete) {
    redirect(ROUTES.dashboard);
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const [workspace, invite] = await Promise.all([
    loadWorkspace(supabase, membership),
    loadInvite(supabase, membership),
  ]);

  return (
    <OnboardingShell>
      {profileError ? (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            We could not create your profile row in Supabase. Re-run the SQL
            migrations, then refresh this page.
          </AlertDescription>
        </Alert>
      ) : null}
      <OnboardingWizard
        initialStep={profile?.onboarding_step ?? 0}
        initialProfile={toWizardProfile(profile, email)}
        initialWorkspace={workspace}
        initialInvite={invite}
      />
    </OnboardingShell>
  );
}
