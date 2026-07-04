"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, HeartHandshake, MailOpen, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  createWorkspaceAction,
  joinWorkspaceAction,
  skipStepAction,
} from "../actions";
import type { WizardWorkspace } from "./wizard-constants";
import { createWorkspaceSchema, joinWorkspaceSchema } from "./wizard-schemas";
import { WizardFooter } from "./wizard-footer";
import { SoftNote, StepCard } from "./wizard-ui";

export function StepWorkspace({
  workspace,
  onBack,
  onWorkspaceReady,
  onContinue,
}: {
  workspace: WizardWorkspace | null;
  onBack: () => void;
  /** Called after creating or joining — the wizard decides the next step. */
  onWorkspaceReady: (ws: WizardWorkspace) => void;
  /** Called when a workspace already exists and the person continues. */
  onContinue: () => void;
}) {
  const [name, setName] = useState("Our shared space");
  const [token, setToken] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const busy = creating || joining || continuing;

  // Already a member (created earlier, or accepted an invite link) —
  // confirm which space they're in and move along.
  if (workspace) {
    async function handleContinue() {
      setContinuing(true);
      const result = await skipStepAction({ step: 1 });
      if (result?.error) {
        toast.error(result.error);
        setContinuing(false);
        return;
      }
      onContinue();
    }

    return (
      <StepCard
        icon={Users}
        title="You're in!"
        description={
          workspace.role === "owner"
            ? `Your space "${workspace.name}" is ready and waiting.`
            : `You've joined "${workspace.name}". You two are officially planning together.`
        }
      >
        <SoftNote>
          You each keep your own login and your own privacy settings. Anything
          you mark private stays yours alone.
        </SoftNote>
        <WizardFooter
          onBack={onBack}
          submitting={continuing}
          onContinue={handleContinue}
        />
      </StepCard>
    );
  }

  async function handleCreate() {
    const parsed = createWorkspaceSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Give your space a name");
      return;
    }
    setNameError(null);
    setCreating(true);
    const result = await createWorkspaceAction(parsed.data);
    if (result.error || !result.workspace) {
      toast.error(result.error ?? "Something didn't save. Please try again.");
      setCreating(false);
      return;
    }
    onWorkspaceReady(result.workspace);
  }

  async function handleJoin() {
    const parsed = joinWorkspaceSchema.safeParse({ token });
    if (!parsed.success) {
      setTokenError(
        parsed.error.issues[0]?.message ?? "Paste your invite link or code"
      );
      return;
    }
    setTokenError(null);
    setJoining(true);
    const result = await joinWorkspaceAction(parsed.data);
    if (result.error || !result.workspace) {
      toast.error(result.error ?? "Something didn't save. Please try again.");
      setJoining(false);
      return;
    }
    onWorkspaceReady(result.workspace);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HeartHandshake className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-lg">Create our space</CardTitle>
          <CardDescription className="leading-relaxed">
            Start fresh and invite your partner in a moment. No money details
            needed yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field data-invalid={!!nameError || undefined}>
            <FieldLabel htmlFor="ob-workspace-name">
              Name your space
            </FieldLabel>
            <Input
              id="ob-workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex & Jamie"
              className="h-11"
              aria-invalid={!!nameError}
              maxLength={80}
            />
            {nameError && <FieldError errors={[{ message: nameError }]} />}
          </Field>
          <Button
            type="button"
            className="h-11 w-full"
            onClick={handleCreate}
            disabled={busy}
          >
            {creating && <Spinner />}
            Create our space
          </Button>
        </CardContent>
      </Card>

      <div
        className="flex items-center gap-3 px-2 text-xs font-medium text-muted-foreground"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Card>
        <CardHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailOpen className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-lg">I have an invite</CardTitle>
          <CardDescription className="leading-relaxed">
            Your partner already set up a space? Paste the invite link or code
            they sent you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field data-invalid={!!tokenError || undefined}>
            <FieldLabel htmlFor="ob-invite-token">
              Invite link or code
            </FieldLabel>
            <Input
              id="ob-invite-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="https://…/invite/…"
              className="h-11"
              autoComplete="off"
              aria-invalid={!!tokenError}
            />
            <FieldDescription>
              Got the invite by email? Opening the link in that email works
              too — you&apos;ll land right back here.
            </FieldDescription>
            {tokenError && <FieldError errors={[{ message: tokenError }]} />}
          </Field>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={handleJoin}
            disabled={busy}
          >
            {joining && <Spinner />}
            Join their space
          </Button>
        </CardContent>
      </Card>

      <div>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-3"
          onClick={onBack}
          disabled={busy}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
      </div>
    </div>
  );
}
