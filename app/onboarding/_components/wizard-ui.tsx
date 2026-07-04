"use client";

/** Small presentational building blocks shared by the wizard steps. */

import type { LucideIcon } from "lucide-react";
import { Home, Lock, Plus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VISIBILITY_LEVELS,
  VISIBILITY_META,
  type Visibility,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/** The card each step lives in: friendly icon, heading, supporting copy. */
export function StepCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <CardTitle className="text-lg leading-snug">{title}</CardTitle>
        {description && (
          <CardDescription className="leading-relaxed">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

const VISIBILITY_ICONS: Record<Visibility, LucideIcon> = {
  private: Lock,
  shared: Users,
  household: Home,
};

/**
 * Compact visibility picker for repeated rows (the full radio-card
 * VisibilitySelect is too tall to repeat per item).
 */
export function VisibilityInlineSelect({
  value,
  onChange,
  id,
  disabled,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as Visibility)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className="h-11 w-full"
        aria-label="Who can see this"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VISIBILITY_LEVELS.map((level) => {
          const Icon = VISIBILITY_ICONS[level];
          return (
            <SelectItem key={level} value={level}>
              <Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {VISIBILITY_META[level].label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Rounded selectable chip (goal types, priorities, month counts). */
export function ChipToggle({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Bordered panel for one repeatable row (income, debt, investment, goal). */
export function RowCard({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mt-2 -mr-2 size-11 shrink-0 text-muted-foreground"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-1 grid gap-4">{children}</div>
    </div>
  );
}

/** Dashed full-width "add another" button under a list of rows. */
export function AddRowButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full border-dashed"
      onClick={onClick}
      disabled={disabled}
    >
      <Plus className="size-4" aria-hidden="true" />
      {children}
    </Button>
  );
}

/** Calm inline hint used for gentle reassurance under sections. */
export function SoftNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
