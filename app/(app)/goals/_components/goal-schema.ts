import { z } from "zod";
import { GOAL_STATUSES, GOAL_TYPES, VISIBILITY_LEVELS } from "@/lib/constants";

/**
 * Zod schemas shared by the goals server actions and client forms.
 * Kept in a plain module (not actions.ts) because "use server" files may
 * only export async functions.
 */

export const MAX_GOAL_AMOUNT = 100_000_000;

/** Server-side input for creating/updating a goal (numbers already parsed). */
export const goalInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give this goal a name")
    .max(80, "Keep the name under 80 characters"),
  goalType: z.enum(GOAL_TYPES),
  emoji: z.string().trim().max(8, "Use a single emoji").nullable(),
  targetAmount: z
    .number("Enter a target amount")
    .positive("The target should be more than zero")
    .max(MAX_GOAL_AMOUNT, "That target is a little too large"),
  targetDate: z.iso.date("Use a valid date").nullable(),
  monthlyContribution: z
    .number()
    .positive("Planned contribution should be more than zero")
    .max(MAX_GOAL_AMOUNT, "That amount is a little too large")
    .nullable(),
  visibility: z.enum(VISIBILITY_LEVELS),
  notes: z.string().trim().max(2000, "Keep notes under 2,000 characters").nullable(),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

/** Server-side input for logging a contribution. */
export const contributionInputSchema = z.object({
  goalId: z.uuid(),
  amount: z
    .number("Enter an amount")
    .positive("The amount should be more than zero")
    .max(MAX_GOAL_AMOUNT, "That amount is a little too large"),
  contributedOn: z.iso.date("Use a valid date"),
  note: z.string().trim().max(500, "Keep the note under 500 characters").nullable(),
});
export type ContributionInput = z.infer<typeof contributionInputSchema>;

export const goalStatusSchema = z.enum(GOAL_STATUSES);

/** Client-side form values (amounts stay strings until submit). */
export const goalFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give this goal a name")
    .max(80, "Keep the name under 80 characters"),
  goalType: z.enum(GOAL_TYPES),
  emoji: z.string().trim().max(8, "Use a single emoji"),
  targetAmount: z.string().refine((v) => {
    const n = Number(v);
    return v !== "" && Number.isFinite(n) && n > 0;
  }, "Enter a target amount"),
  targetDate: z.string(),
  monthlyContribution: z
    .string()
    .refine(
      (v) => v === "" || (Number.isFinite(Number(v)) && Number(v) > 0),
      "Should be more than zero"
    ),
  visibility: z.enum(VISIBILITY_LEVELS),
  notes: z.string().max(2000, "Keep notes under 2,000 characters"),
});
export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const contributionFormSchema = z.object({
  amount: z.string().refine((v) => {
    const n = Number(v);
    return v !== "" && Number.isFinite(n) && n > 0;
  }, "Enter an amount"),
  contributedOn: z.string().min(1, "Pick a date"),
  note: z.string().max(500, "Keep the note under 500 characters"),
});
export type ContributionFormValues = z.infer<typeof contributionFormSchema>;
