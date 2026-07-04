"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveProfileStepAction } from "../actions";
import { CURRENCY_OPTIONS, type WizardProfile } from "./wizard-constants";
import { profileStepSchema, type ProfileStepInput } from "./wizard-schemas";
import { WizardFooter } from "./wizard-footer";
import { StepCard } from "./wizard-ui";

const CURRENCY_CODES = new Set(CURRENCY_OPTIONS.map((c) => c.code));

export function StepProfile({
  profile,
  onDone,
}: {
  profile: WizardProfile;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ProfileStepInput>({
    resolver: zodResolver(profileStepSchema),
    defaultValues: {
      fullName: profile.fullName ?? "",
      currency: CURRENCY_CODES.has(profile.currency)
        ? profile.currency
        : "USD",
    },
  });

  async function onSubmit(values: ProfileStepInput) {
    setSubmitting(true);
    const result = await saveProfileStepAction(values);
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    onDone();
  }

  const { errors } = form.formState;

  return (
    <StepCard
      icon={UserRound}
      title="First, a little about you"
      description="Just the basics. Your partner sets up their own profile separately — with their own privacy settings."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.fullName || undefined}>
            <FieldLabel htmlFor="ob-full-name">Your name</FieldLabel>
            <Input
              id="ob-full-name"
              autoComplete="name"
              placeholder="e.g. Alex Rivera"
              className="h-11"
              aria-invalid={!!errors.fullName}
              {...form.register("fullName")}
            />
            <FieldError errors={[errors.fullName]} />
          </Field>

          <Field data-invalid={!!errors.currency || undefined}>
            <FieldLabel htmlFor="ob-currency">Currency</FieldLabel>
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ob-currency" className="h-11 w-full">
                    <SelectValue placeholder="Choose a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>
              How amounts are displayed for you. You can change this anytime.
            </FieldDescription>
            <FieldError errors={[errors.currency]} />
          </Field>

          <WizardFooter submitting={submitting} />
        </FieldGroup>
      </form>
    </StepCard>
  );
}
