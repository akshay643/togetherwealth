import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { sanitizeNextPath } from "@/lib/validations/auth";
import { SignupForm } from "../_components/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = sanitizeNextPath(searchParams.next) ?? undefined;

  const loginHref = next
    ? `${ROUTES.login}?next=${encodeURIComponent(next)}`
    : ROUTES.login;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Start planning money together — on your terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm next={next} />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
