import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { sanitizeNextPath } from "@/lib/validations/auth";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = sanitizeNextPath(searchParams.next) ?? undefined;
  const error =
    typeof searchParams.error === "string" && searchParams.error.length > 0
      ? searchParams.error
      : null;

  const signupHref = next
    ? `${ROUTES.signup}?next=${encodeURIComponent(next)}`
    : ROUTES.signup;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Log in to keep planning together.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <LoginForm next={next} />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        New to TogetherWealth?{" "}
        <Link
          href={signupHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
