"use server";

import { redirect } from "next/navigation";

import { logActivity, notifyPartner } from "@/lib/activity";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { acceptInviteSchema } from "@/lib/validations/auth";

/**
 * The accept_partner_invite RPC raises calm, user-facing messages.
 * Pass those through verbatim; anything else gets a generic fallback.
 */
const KNOWN_INVITE_ERRORS = [
  "This invite link is not valid.",
  "This invite is no longer active.",
  "This invite has expired. Ask your partner to send a new one.",
  "This invite was sent to a different email address. Sign in with the invited email to accept it.",
  "You must be signed in to accept an invite.",
];

export async function acceptInviteAction(
  token: string
): Promise<{ error: string }> {
  const parsed = acceptInviteSchema.safeParse({ token });
  if (!parsed.success) {
    return { error: "This invite link is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please log in first to accept this invite." };
  }

  const { data: workspaceId, error } = await supabase.rpc(
    "accept_partner_invite",
    { invite_token: parsed.data.token }
  );

  if (error || !workspaceId) {
    const message = error?.message ?? "";
    const known = KNOWN_INVITE_ERRORS.find((m) => message.includes(m));
    return {
      error:
        known ??
        "We couldn't accept this invite just now. Please try again in a moment.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.full_name ?? profile?.email ?? "Your partner";

  await logActivity(supabase, {
    workspaceId,
    actorId: user.id,
    eventType: "member.joined",
    summary: `${displayName} accepted the invite and joined the workspace`,
    entityType: "workspace",
    entityId: workspaceId,
    visibility: "household",
  });

  await notifyPartner(supabase, {
    workspaceId,
    actorId: user.id,
    type: "member.joined",
    title: `${displayName} accepted your invite`,
    body: "You're now planning money together in TogetherWealth.",
    link: ROUTES.dashboard,
  });

  redirect(ROUTES.onboarding);
}

/**
 * Used when the invite was sent to a different email than the current
 * session: sign out, then return to login carrying the invite as `next`.
 */
export async function switchAccountAction(token: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.invite(token))}`);
}
