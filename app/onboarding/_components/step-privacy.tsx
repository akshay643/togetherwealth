"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Home, Lock, ShieldCheck, Users } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  VISIBILITY_LEVELS,
  VISIBILITY_META,
  type Visibility,
} from "@/lib/constants";
import { savePrivacyAction } from "../actions";
import { WizardFooter } from "./wizard-footer";
import { SoftNote, StepCard } from "./wizard-ui";

const VISIBILITY_ICONS: Record<Visibility, LucideIcon> = {
  private: Lock,
  shared: Users,
  household: Home,
};

export function StepPrivacy({
  initialShare,
  onBack,
  onDone,
}: {
  initialShare: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const [share, setShare] = useState(initialShare);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    setSubmitting(true);
    const result = await savePrivacyAction({ sharePersonalNetWorth: share });
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    onDone();
  }

  return (
    <StepCard
      icon={ShieldCheck}
      title="Privacy, on your terms"
      description="Everything you add — accounts, expenses, debts, goals — gets its own visibility. Here's what each level means."
    >
      <ul className="grid gap-2">
        {VISIBILITY_LEVELS.map((level) => {
          const meta = VISIBILITY_META[level];
          const Icon = VISIBILITY_ICONS[level];
          return (
            <li
              key={level}
              className="flex items-start gap-3 rounded-lg border bg-card p-3.5"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm leading-tight font-medium">
                  {meta.label}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {meta.description}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-start justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="min-w-0">
          <Label
            htmlFor="ob-share-net-worth"
            className="text-sm leading-snug font-medium"
          >
            Share my personal net worth
          </Label>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When on, your partner can see your overall net worth number —
            never the private items behind it. Off is a perfectly good
            choice, and you can flip this anytime.
          </p>
        </div>
        <Switch
          id="ob-share-net-worth"
          checked={share}
          onCheckedChange={setShare}
          className="mt-0.5"
        />
      </div>

      <SoftNote>
        Private really means private: it never appears in your partner&apos;s
        views or your shared totals. You choose item by item as you go.
      </SoftNote>

      <WizardFooter
        onBack={onBack}
        submitting={submitting}
        onContinue={handleContinue}
      />
    </StepCard>
  );
}
