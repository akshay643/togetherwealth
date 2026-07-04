"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import {
  DEMO_SESSION_COOKIE,
  demoEnabled,
  isDemoLogin,
} from "@/lib/demo-session";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  sanitizeNextPath,
  signupSchema,
} from "@/lib/validations/auth";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function loginAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<{ error: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check your email and password and try again." };
  }

  if (
    demoEnabled() &&
    isDemoLogin(parsed.data.email, parsed.data.password)
  ) {
    const cookieStore = await cookies();
    cookieStore.set(DEMO_SESSION_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect(sanitizeNextPath(input.next) ?? ROUTES.dashboard);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Your email isn't confirmed yet. Check your inbox for the confirmation link we sent you.",
      };
    }
    return {
      error:
        "That email and password combination didn't match our records. Please try again.",
    };
  }

  redirect(sanitizeNextPath(input.next) ?? ROUTES.dashboard);
}

export async function signupAction(input: {
  fullName: string;
  email: string;
  password: string;
  next?: string;
}): Promise<{ error: string } | { checkEmail: true }> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Please double-check your details and try again.",
    };
  }

  const next = sanitizeNextPath(input.next);
  const emailRedirectTo = `${appUrl()}/auth/confirm${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo,
      data: { full_name: parsed.data.fullName },
    },
  });

  const alreadyRegistered = {
    error:
      "It looks like you already have an account with that email. Try logging in instead — or reset your password if you've forgotten it.",
  };

  if (error) {
    if (
      error.code === "user_already_exists" ||
      /already registered/i.test(error.message)
    ) {
      return alreadyRegistered;
    }
    return {
      error:
        "We couldn't create your account just now. Please try again in a moment.",
    };
  }

  // With email confirmations enabled, Supabase returns an obfuscated user
  // with an empty identities array when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return alreadyRegistered;
  }

  if (data.session) {
    redirect(next ?? ROUTES.onboarding);
  }

  return { checkEmail: true };
}

export async function forgotPasswordAction(input: {
  email: string;
}): Promise<{ error: string } | { success: true }> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${appUrl()}/auth/confirm?next=${encodeURIComponent(
        ROUTES.resetPassword
      )}`,
    }
  );

  if (error) {
    return {
      error:
        "We couldn't send the reset email just now. Please try again in a moment.",
    };
  }

  return { success: true };
}

export async function resetPasswordAction(input: {
  password: string;
  confirmPassword: string;
}): Promise<{ error: string }> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Please double-check your new password and try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Your reset link has expired or was already used. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "same_password") {
      return {
        error: "Your new password needs to be different from your current one.",
      };
    }
    return {
      error:
        "We couldn't update your password just now. Please request a new reset link and try again.",
    };
  }

  redirect(ROUTES.dashboard);
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);

  const supabase = await createClient();
  await supabase.auth.signOut();
}
