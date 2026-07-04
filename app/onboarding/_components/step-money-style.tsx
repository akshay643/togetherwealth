"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Coins, Scale, Wallet, WalletCards } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  MONEY_STYLES,
  MONEY_STYLE_META,
  type MoneyStyle,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { saveMoneyStyleAction } from "../actions";
import type { WizardWorkspace } from "./wizard-constants";
import { WizardFooter } from "./wizard-footer";
import { SoftNote, StepCard } from "./wizard-ui";

const STYLE_ICONS: Record<MoneyStyle, LucideIcon> = {
  joint: Wallet,
  separate: WalletCards,
  hybrid: Coins,
};

export function StepMoneyStyle({
  workspace,
  initialPref,
  onBack,
  onDone,
}: {
  workspace: WizardWorkspace;
  initialPref: MoneyStyle | null;
  onBack: () => void;
  onDone: (style: MoneyStyle) => void;
}) {
  const isOwner = workspace.role === "owner";
  const groupId = useId();
  const [style, setStyle] = useState<MoneyStyle>(
    initialPref ?? workspace.moneyStyle
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    setSubmitting(true);
    const result = await saveMoneyStyleAction({ moneyStyle: style });
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    onDone(style);
  }

  return (
    <StepCard
      icon={Scale}
      title="How do you two like to organize money?"
      description="There's no right answer — plenty of happy couples use each of these. Pick whatever feels most like you."
    >
      {!isOwner && (
        <SoftNote>
          Your space is currently set to{" "}
          <span className="font-medium text-foreground">
            {MONEY_STYLE_META[workspace.moneyStyle].label}
          </span>{" "}
          — your partner chose that while setting up. Your pick below is saved
          as your personal preference, and you two can change the shared
          setting together in Settings anytime.
        </SoftNote>
      )}

      <RadioGroup
        value={style}
        onValueChange={(v) => setStyle(v as MoneyStyle)}
        className="grid gap-2"
        aria-label="Money style"
      >
        {MONEY_STYLES.map((option) => {
          const meta = MONEY_STYLE_META[option];
          const Icon = STYLE_ICONS[option];
          const itemId = `${groupId}-${option}`;
          const selected = style === option;
          return (
            <Label
              key={option}
              htmlFor={itemId}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3.5 transition-colors",
                selected
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/50"
              )}
            >
              <RadioGroupItem id={itemId} value={option} className="mt-0.5" />
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm leading-tight font-medium">
                  {meta.label}
                </span>
                <span className="text-xs leading-relaxed font-normal text-muted-foreground">
                  {meta.description}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>

      <WizardFooter
        onBack={onBack}
        submitting={submitting}
        onContinue={handleContinue}
      />
    </StepCard>
  );
}
