"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ROUTES, type MoneyStyle } from "@/lib/constants";
import { finishOnboardingAction } from "../actions";
import { StepIncome } from "./step-income";
import { StepInvitePartner } from "./step-invite-partner";
import { StepMoneyStyle } from "./step-money-style";
import { StepPrivacy } from "./step-privacy";
import { StepProfile } from "./step-profile";
import { StepWorkspace } from "./step-workspace";
import {
  STEP_TITLES,
  type WizardInvite,
  type WizardProfile,
  type WizardWorkspace,
} from "./wizard-constants";

type WizardProps = {
  initialStep: number;
  initialProfile: WizardProfile;
  initialWorkspace: WizardWorkspace | null;
  initialInvite: WizardInvite | null;
};

const LAST_INTERACTIVE_STEP = 5;
const ACTIVE_STEP_TITLES = STEP_TITLES.slice(0, LAST_INTERACTIVE_STEP + 1);
const ACTIVE_STEP_COUNT = ACTIVE_STEP_TITLES.length;

function clampInitialStep(step: number, workspace: WizardWorkspace | null) {
  if (!Number.isFinite(step) || step < 0) return 0;
  if (!workspace && step > 1) return 1;
  return Math.min(step, LAST_INTERACTIVE_STEP);
}

export function OnboardingWizard({
  initialStep,
  initialProfile,
  initialWorkspace,
  initialInvite,
}: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(() =>
    clampInitialStep(initialStep, initialWorkspace)
  );
  const [profile, setProfile] = useState(initialProfile);
  const [workspace, setWorkspace] =
    useState<WizardWorkspace | null>(initialWorkspace);
  const [invite, setInvite] = useState<WizardInvite | null>(initialInvite);
  const [finishing, setFinishing] = useState(false);

  const visibleStep = Math.min(step, LAST_INTERACTIVE_STEP);
  const progress = useMemo(
    () => Math.round(((visibleStep + 1) / ACTIVE_STEP_COUNT) * 100),
    [visibleStep]
  );

  function back() {
    setStep((current) => Math.max(0, current - 1));
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    const result = await finishOnboardingAction({
      riskComfort: profile.riskComfort ?? 3,
      stressNotes: profile.stressNotes ?? "",
      priorities: profile.priorities ?? [],
    });

    if (result?.error) {
      toast.error(result.error);
      setFinishing(false);
      return;
    }

    router.push(ROUTES.dashboard);
    router.refresh();
  }

  function nextAfterWorkspace(nextWorkspace: WizardWorkspace) {
    setWorkspace(nextWorkspace);
    setStep(nextWorkspace.role === "owner" ? 2 : 3);
  }

  let content: React.ReactNode;

  if (finishing) {
    content = (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Finishing setup</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Getting your workspace ready.
          </p>
        </CardContent>
      </Card>
    );
  } else if (step <= 0) {
    content = (
      <StepProfile
        profile={profile}
        onDone={() => {
          setStep(1);
        }}
      />
    );
  } else if (step === 1 || !workspace) {
    content = (
      <StepWorkspace
        workspace={workspace}
        onBack={back}
        onWorkspaceReady={nextAfterWorkspace}
        onContinue={() => {
          setStep(workspace?.role === "owner" ? 2 : 3);
        }}
      />
    );
  } else if (step === 2 && workspace.role === "owner") {
    content = (
      <StepInvitePartner
        invite={invite}
        onInviteCreated={setInvite}
        onBack={back}
        onDone={() => setStep(3)}
      />
    );
  } else if (step <= 3) {
    content = (
      <StepMoneyStyle
        workspace={workspace}
        initialPref={profile.moneyStylePref}
        onBack={back}
        onDone={(style: MoneyStyle) => {
          setProfile((current) => ({ ...current, moneyStylePref: style }));
          setWorkspace((current) =>
            current ? { ...current, moneyStyle: style } : current
          );
          setStep(4);
        }}
      />
    );
  } else if (step === 4) {
    content = (
      <StepPrivacy
        initialShare={profile.sharePersonalNetWorth}
        onBack={back}
        onDone={() => {
          setStep(5);
        }}
      />
    );
  } else if (step === 5) {
    content = <StepIncome onBack={back} onDone={finish} />;
  } else {
    content = (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Setup is ready</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Jump into your dashboard and keep building from there.
          </p>
          <Button className="mt-2 h-11 w-full max-w-xs" onClick={finish}>
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Step {visibleStep + 1} of {ACTIVE_STEP_COUNT}
          </span>
          <span>{ACTIVE_STEP_TITLES[visibleStep]}</span>
        </div>
        <Progress value={progress} />
      </div>
      {content}
    </div>
  );
}
