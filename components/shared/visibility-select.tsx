"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { Home, Lock, Users } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  VISIBILITY_LEVELS,
  VISIBILITY_META,
  type Visibility,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const VISIBILITY_ICONS: Record<Visibility, LucideIcon> = {
  private: Lock,
  shared: Users,
  household: Home,
};

export interface VisibilitySelectProps {
  value: Visibility;
  onChange: (v: Visibility) => void;
  disabled?: boolean;
}

/**
 * Radio-card selector for an item's visibility. Controlled via value/onChange
 * so it drops straight into react-hook-form Controller/FormField render props.
 */
export function VisibilitySelect({
  value,
  onChange,
  disabled,
}: VisibilitySelectProps) {
  const groupId = useId();

  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as Visibility)}
      disabled={disabled}
      className="grid gap-2"
      aria-label="Visibility"
    >
      {VISIBILITY_LEVELS.map((level) => {
        const meta = VISIBILITY_META[level];
        const Icon = VISIBILITY_ICONS[level];
        const itemId = `${groupId}-${level}`;
        const selected = value === level;

        return (
          <Label
            key={level}
            htmlFor={itemId}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors",
              selected
                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                : "hover:bg-muted/50",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <RadioGroupItem id={itemId} value={level} className="mt-0.5" />
            <Icon
              aria-hidden
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
  );
}
