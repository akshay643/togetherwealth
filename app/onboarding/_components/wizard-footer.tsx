"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { skipStepAction } from "../actions";

/**
 * Back / Skip / Continue row shared by every step.
 *
 * - When `onContinue` is omitted, the Continue button is type="submit" and
 *   should live inside the step's <form>.
 * - Passing `skipStep` renders a "Skip for now" button that persists
 *   progress via skipStepAction, then calls `onSkipped`.
 */
export function WizardFooter({
  onBack,
  submitting = false,
  continueLabel = "Continue",
  onContinue,
  continueDisabled = false,
  skipStep,
  onSkipped,
}: {
  onBack?: () => void;
  submitting?: boolean;
  continueLabel?: string;
  onContinue?: () => void;
  continueDisabled?: boolean;
  skipStep?: number;
  onSkipped?: () => void;
}) {
  const [skipping, setSkipping] = useState(false);
  const busy = submitting || skipping;

  async function handleSkip() {
    if (skipStep === undefined) return;
    setSkipping(true);
    const result = await skipStepAction({ step: skipStep });
    if (result?.error) {
      toast.error(result.error);
      setSkipping(false);
      return;
    }
    // Leave `skipping` true — the step unmounts as the wizard advances.
    onSkipped?.();
  }

  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <div>
        {onBack && (
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
        )}
      </div>
      <div className="flex items-center gap-2">
        {skipStep !== undefined && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-muted-foreground"
            onClick={handleSkip}
            disabled={busy}
          >
            {skipping && <Spinner />}
            Skip for now
          </Button>
        )}
        <Button
          type={onContinue ? "button" : "submit"}
          onClick={onContinue}
          className="h-11 min-w-28"
          disabled={busy || continueDisabled}
        >
          {submitting && <Spinner />}
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
