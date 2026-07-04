"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { loginAction } from "../actions";

const DEMO_EMAIL = "alex@demo.togetherwealth.app";
const DEMO_PASSWORD = "demo-password-123";

export function LoginForm({ next }: { next?: string }) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const result = await loginAction({ ...values, next });
      if (result?.error) {
        toast.error(result.error);
        setSubmitting(false);
      }
      // On success the server action redirects — keep the button busy
      // while the client navigates.
    } catch (err) {
      // redirect() throws internally in Next — rethrow so navigation happens.
      throw err;
    }
  }

  function fillDemo() {
    form.setValue("email", DEMO_EMAIL, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
  }

  const { errors } = form.formState;

  return (
    <div className="space-y-5">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email || undefined}>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password || undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Link
                href={`/forgot-password${next ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="h-11"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>

          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </FieldGroup>
      </form>

      <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Try the demo:</span>{" "}
          {DEMO_EMAIL} / {DEMO_PASSWORD}
        </p>
        <button
          type="button"
          onClick={fillDemo}
          className="mt-1.5 inline-flex min-h-6 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          <Sparkles className="size-3" aria-hidden="true" />
          Fill in the demo login
        </button>
      </div>
    </div>
  );
}
