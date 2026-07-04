"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ROUTES } from "@/lib/constants";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { signupAction } from "../actions";

export function SignupForm({ next }: { next?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    const result = await signupAction({ ...values, next });
    // On a live session the action redirects and never resolves here.
    if (result && "error" in result) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    if (result && "checkEmail" in result) {
      setSentTo(values.email);
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{sentTo}</span>. Click
          it to finish setting up your account.
        </p>
        <p className="text-xs text-muted-foreground">
          Nothing there after a minute or two? Check your spam folder.
        </p>
        <Button asChild variant="outline" className="mt-2 h-11 w-full">
          <Link href={ROUTES.login}>Back to log in</Link>
        </Button>
      </div>
    );
  }

  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.fullName || undefined}>
          <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            placeholder="Jordan Rivera"
            className="h-11"
            aria-invalid={!!errors.fullName}
            {...form.register("fullName")}
          />
          <FieldError errors={[errors.fullName]} />
        </Field>

        <Field data-invalid={!!errors.email || undefined}>
          <FieldLabel htmlFor="signup-email">Email</FieldLabel>
          <Input
            id="signup-email"
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
          <FieldLabel htmlFor="signup-password">Password</FieldLabel>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? "Creating your account…" : "Create account"}
        </Button>
      </FieldGroup>
    </form>
  );
}
