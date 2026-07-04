import { NextResponse, type NextRequest } from "next/server";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/validations/auth";

/**
 * OAuth / PKCE callback: exchanges the auth code for a session,
 * then continues to `next` (default: dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next")) ?? ROUTES.dashboard;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const loginUrl = new URL(ROUTES.login, request.url);
  loginUrl.searchParams.set(
    "error",
    "We couldn't finish signing you in. Please try again."
  );
  return NextResponse.redirect(loginUrl);
}
