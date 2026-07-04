"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, MailCheck, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createInviteAction, skipStepAction } from "../actions";
import type { WizardInvite } from "./wizard-constants";
import { invitePartnerSchema, type InvitePartnerInput } from "./wizard-schemas";
import { WizardFooter } from "./wizard-footer";
import { SoftNote, StepCard } from "./wizard-ui";

export function StepInvitePartner({
  invite,
  onInviteCreated,
  onBack,
  onDone,
}: {
  invite: WizardInvite | null;
  onInviteCreated: (invite: WizardInvite) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [continuing, setContinuing] = useState(false);

  const form = useForm<InvitePartnerInput>({
    resolver: zodResolver(invitePartnerSchema),
    defaultValues: { email: "", message: "" },
  });

  async function onSubmit(values: InvitePartnerInput) {
    setSubmitting(true);
    const result = await createInviteAction(values);
    setSubmitting(false);
    if (result.error || !result.inviteUrl || !result.email) {
      toast.error(result.error ?? "Something didn't save. Please try again.");
      return;
    }
    onInviteCreated({ url: result.inviteUrl, email: result.email });
  }

  async function handleContinue() {
    setContinuing(true);
    const result = await skipStepAction({ step: 2 });
    if (result?.error) {
      toast.error(result.error);
      setContinuing(false);
      return;
    }
    onDone();
  }

  async function copyLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it manually.");
    }
  }

  // Invite created (now or on an earlier visit): show the shareable link.
  if (invite) {
    return (
      <StepCard
        icon={MailCheck}
        title="Your invite is ready"
        description={`Share this link with ${invite.email} however you like — text, email, or a note on the fridge.`}
      >
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-2 pl-3">
          <p className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
            {invite.url}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            onClick={copyLink}
            aria-label="Copy invite link"
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <SoftNote>
          When your partner joins, they set up their own login and choose
          their own privacy preferences. Nothing you&apos;ve entered is shared
          automatically — you each decide what the other sees.
        </SoftNote>
        <WizardFooter
          onBack={onBack}
          submitting={continuing}
          onContinue={handleContinue}
        />
      </StepCard>
    );
  }

  const { errors } = form.formState;

  return (
    <StepCard
      icon={UserRoundPlus}
      title="Invite your partner"
      description="Planning works best as a duo — but you&apos;re welcome to explore solo first and invite them anytime from Settings."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email || undefined}>
            <FieldLabel htmlFor="ob-partner-email">
              Your partner&apos;s email
            </FieldLabel>
            <Input
              id="ob-partner-email"
              type="email"
              autoComplete="off"
              placeholder="partner@example.com"
              className="h-11"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldDescription>
              We&apos;ll match the invite to this email when they join.
            </FieldDescription>
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.message || undefined}>
            <FieldLabel htmlFor="ob-partner-message">
              Add a note (optional)
            </FieldLabel>
            <Textarea
              id="ob-partner-message"
              rows={3}
              placeholder="Found us a place to plan money together — join me?"
              aria-invalid={!!errors.message}
              {...form.register("message")}
            />
            <FieldError errors={[errors.message]} />
          </Field>

          <SoftNote>
            Your partner sets their own privacy preferences. Private always
            means private — for both of you.
          </SoftNote>

          <WizardFooter
            onBack={onBack}
            submitting={submitting}
            continueLabel="Create invite"
            skipStep={2}
            onSkipped={onDone}
          />
        </FieldGroup>
      </form>
    </StepCard>
  );
}
