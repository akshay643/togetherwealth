import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  CheckCheck,
  HeartHandshake,
  MailQuestion,
  TimerOff,
  Unlink,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "./_components/accept-invite-button";
import { switchAccountAction } from "./actions";

export const metadata: Metadata = { title: "Partner invite" };

function getRequestTimeMs() {
  return Date.now();
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
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

function StatusCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

export default async function InvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Invites are looked up by their secret token, which acts as the
  // capability here — RLS blocks logged-out (and not-yet-member) reads,
  // so this display-only lookup runs server-side with the admin client.
  // Accepting still goes through the user-scoped RPC, which re-checks
  // everything (status, expiry, invited email).
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("partner_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <InviteShell>
        <StatusCard
          icon={Unlink}
          title="This invite link isn't valid"
          description="Double-check the link from your email, or ask your partner to send a fresh one."
        >
          <Button asChild variant="outline" className="mt-2 h-11 w-full max-w-xs">
            <Link href={user ? ROUTES.dashboard : ROUTES.login}>
              {user ? "Go to your dashboard" : "Go to log in"}
            </Link>
          </Button>
        </StatusCard>
      </InviteShell>
    );
  }

  const [{ data: workspace }, { data: inviter }] = await Promise.all([
    admin
      .from("couple_workspaces")
      .select("name")
      .eq("id", invite.workspace_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", invite.invited_by)
      .maybeSingle(),
  ]);

  const inviterName = inviter?.full_name ?? inviter?.email ?? "Your partner";
  const workspaceName = workspace?.name ?? "your shared workspace";

  // Is the current user already in this workspace?
  let alreadyMember = false;
  if (user) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", invite.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    alreadyMember = !!membership;
  }

  if (alreadyMember) {
    return (
      <InviteShell>
        <StatusCard
          icon={Users}
          title={`You're already part of ${workspaceName}`}
          description="Nothing more to do here — you and your partner are already planning together."
        >
          <Button asChild className="mt-2 h-11 w-full max-w-xs">
            <Link href={ROUTES.dashboard}>Go to your dashboard</Link>
          </Button>
        </StatusCard>
      </InviteShell>
    );
  }

  const isExpired =
    invite.status === "expired" ||
    (invite.status === "pending" &&
      new Date(invite.expires_at).getTime() < getRequestTimeMs());

  if (isExpired) {
    return (
      <InviteShell>
        <StatusCard
          icon={TimerOff}
          title="This invite has expired"
          description={`Invites only stay open for a little while. Ask ${inviterName} to send a new one and you'll be planning together in no time.`}
        >
          <Button asChild variant="outline" className="mt-2 h-11 w-full max-w-xs">
            <Link href={user ? ROUTES.dashboard : ROUTES.login}>
              {user ? "Go to your dashboard" : "Go to log in"}
            </Link>
          </Button>
        </StatusCard>
      </InviteShell>
    );
  }

  if (invite.status === "revoked") {
    return (
      <InviteShell>
        <StatusCard
          icon={Ban}
          title="This invite is no longer active"
          description={`It looks like this invite was withdrawn. If you'd still like to join, ask ${inviterName} to send a new one.`}
        >
          <Button asChild variant="outline" className="mt-2 h-11 w-full max-w-xs">
            <Link href={user ? ROUTES.dashboard : ROUTES.login}>
              {user ? "Go to your dashboard" : "Go to log in"}
            </Link>
          </Button>
        </StatusCard>
      </InviteShell>
    );
  }

  if (invite.status === "accepted") {
    return (
      <InviteShell>
        <StatusCard
          icon={CheckCheck}
          title="This invite has already been used"
          description="If that was you on another account, log in with that account to get back to your shared workspace."
        >
          <Button asChild variant="outline" className="mt-2 h-11 w-full max-w-xs">
            <Link href={user ? ROUTES.dashboard : ROUTES.login}>
              {user ? "Go to your dashboard" : "Go to log in"}
            </Link>
          </Button>
        </StatusCard>
      </InviteShell>
    );
  }

  // Pending invite, logged out: explain, then send through login/signup
  // carrying the invite as `next`.
  if (!user) {
    const nextParam = encodeURIComponent(ROUTES.invite(token));
    return (
      <InviteShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HeartHandshake className="size-6" aria-hidden="true" />
            </span>
            <h1 className="text-lg font-semibold">
              You&apos;re invited to plan together
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {inviterName} invited you to join{" "}
              <span className="font-medium text-foreground">
                {workspaceName}
              </span>{" "}
              on {APP_NAME}.
            </p>
            {invite.message && (
              <blockquote className="w-full rounded-lg border bg-muted/40 px-4 py-3 text-sm italic leading-relaxed text-muted-foreground">
                &ldquo;{invite.message}&rdquo;
              </blockquote>
            )}
            <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
              <Button asChild className="h-11 w-full">
                <Link href={`${ROUTES.login}?next=${nextParam}`}>
                  Log in to accept
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 w-full">
                <Link href={`${ROUTES.signup}?next=${nextParam}`}>
                  Create an account
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the email this invite was sent to:{" "}
              <span className="font-medium text-foreground">
                {invite.email}
              </span>
            </p>
          </CardContent>
        </Card>
      </InviteShell>
    );
  }

  // Pending invite, but the session email doesn't match the invited one.
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return (
      <InviteShell>
        <StatusCard
          icon={MailQuestion}
          title="This invite was sent to a different email"
          description={`It was sent to ${invite.email}, but you're logged in as ${user.email}. Switch to the invited account to accept — or ask ${inviterName} to re-send the invite to this address.`}
        >
          <form
            action={switchAccountAction.bind(null, token)}
            className="mt-2 w-full max-w-xs"
          >
            <Button type="submit" variant="outline" className="h-11 w-full">
              Log in with a different account
            </Button>
          </form>
        </StatusCard>
      </InviteShell>
    );
  }

  // Pending, logged in, right email: ready to accept.
  return (
    <InviteShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HeartHandshake className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Join {workspaceName}</h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {inviterName} invited you to plan money together on {APP_NAME}.
          </p>
          {invite.message && (
            <blockquote className="w-full rounded-lg border bg-muted/40 px-4 py-3 text-sm italic leading-relaxed text-muted-foreground">
              &ldquo;{invite.message}&rdquo;
            </blockquote>
          )}
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            <AcceptInviteButton token={token} />
            <Button asChild variant="ghost" className="h-11 w-full">
              <Link href={ROUTES.dashboard}>Maybe later</Link>
            </Button>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Joining lets you see each other&apos;s shared items. Anything
            either of you marks private stays private.
          </p>
        </CardContent>
      </Card>
    </InviteShell>
  );
}
