import type { Metadata } from "next";
import Link from "next/link";
import { TimerOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "../_components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <TimerOff className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">This reset link has expired</h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Password reset links only work once and for a short while. Request
            a fresh one and you&apos;ll be back in shortly.
          </p>
          <Button asChild className="mt-2 h-11 w-full max-w-xs">
            <Link href={ROUTES.forgotPassword}>Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          You&apos;re resetting the password for{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
