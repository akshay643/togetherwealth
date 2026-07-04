import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/validations/auth";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Handles Supabase email links (confirmation, recovery, email change).
 * Verifies the token_hash server-side, then sends the user on to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = sanitizeNextPath(searchParams.get("next")) ?? ROUTES.dashboard;

  const type = OTP_TYPES.includes(typeParam as EmailOtpType)
    ? (typeParam as EmailOtpType)
    : null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const loginUrl = new URL(ROUTES.login, request.url);
  loginUrl.searchParams.set(
    "error",
    "That link is invalid or has expired. Please request a new one."
  );
  return NextResponse.redirect(loginUrl);
}
