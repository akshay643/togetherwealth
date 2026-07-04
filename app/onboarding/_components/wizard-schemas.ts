/**
 * Zod schemas for the onboarding wizard.
 *
 * Two flavors live here:
 * - "*FormSchema"    — client-side react-hook-form schemas. Money fields are
 *                      the sanitized strings MoneyInput produces.
 * - "*PayloadSchema" — server-action schemas. Money fields are numbers
 *                      (dollars). Actions re-validate every payload.
 *
 * Plain module — safe to import from both server actions and client
 * components.
 */

import { z } from "zod";

import {
  ASSET_CLASSES,
  DEBT_TYPES,
  EXPENSE_CATEGORIES,
  INCOME_FREQUENCIES,
  INCOME_TYPES,
  MONEY_STYLES,
  RISK_LEVELS,
  VISIBILITY_LEVELS,
  type GoalType,
} from "@/lib/constants";
import {
  CURRENCY_OPTIONS,
  SHARED_GOAL_TYPES,
  TOTAL_STEPS,
} from "./wizard-constants";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const CURRENCY_CODES = CURRENCY_OPTIONS.map((c) => c.code) as [
  string,
  ...string[],
];

/**
 * Client-side money field — MoneyInput keeps a sanitized string
 * (digits + one dot, max two decimals). Empty is allowed here; use
 * `requiredMoneyString` when a value is mandatory.
 */
export const moneyString = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d{0,2})?|\.\d{1,2})?$/, "Enter a valid amount");

export const requiredMoneyString = moneyString.refine(
  (v) => Number(v) > 0,
  "Enter an amount"
);

/** Parse a MoneyInput string into dollars (empty/invalid → 0). */
export function parseMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** Server-side dollar amounts. */
const dollars = z.number().finite().min(0).max(100_000_000);
const positiveDollars = z
  .number()
  .finite()
  .positive("Enter an amount greater than zero")
  .max(100_000_000);

const shortText = (msg: string) =>
  z.string().trim().min(1, msg).max(80, "Keep it under 80 characters");

// ---------------------------------------------------------------------------
// Step 0 — personal profile
// ---------------------------------------------------------------------------

export const profileStepSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(120, "That name is a little long"),
  currency: z.enum(CURRENCY_CODES),
});
export type ProfileStepInput = z.infer<typeof profileStepSchema>;

// ---------------------------------------------------------------------------
// Step 1 — couple workspace
// ---------------------------------------------------------------------------

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your space a name")
    .max(80, "Keep it under 80 characters"),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const joinWorkspaceSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Paste the invite link or code your partner sent you"),
});
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;

// ---------------------------------------------------------------------------
// Step 2 — invite partner
// ---------------------------------------------------------------------------

export const invitePartnerSchema = z.object({
  email: z.email("Enter a valid email address"),
  message: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters")
    .optional(),
});
export type InvitePartnerInput = z.infer<typeof invitePartnerSchema>;

// ---------------------------------------------------------------------------
// Step 3 — money style
// ---------------------------------------------------------------------------

export const moneyStyleSchema = z.object({
  moneyStyle: z.enum(MONEY_STYLES),
});
export type MoneyStyleInput = z.infer<typeof moneyStyleSchema>;

// ---------------------------------------------------------------------------
// Step 4 — privacy preferences
// ---------------------------------------------------------------------------

export const privacySchema = z.object({
  sharePersonalNetWorth: z.boolean(),
});
export type PrivacyInput = z.infer<typeof privacySchema>;

// ---------------------------------------------------------------------------
// Step 5 — income & fixed expenses
// ---------------------------------------------------------------------------

export const incomeRowFormSchema = z.object({
  name: shortText("Name this income"),
  incomeType: z.enum(INCOME_TYPES),
  amount: requiredMoneyString,
  frequency: z.enum(INCOME_FREQUENCIES),
  visibility: z.enum(VISIBILITY_LEVELS),
});
export const incomeStepFormSchema = z.object({
  incomes: z
    .array(incomeRowFormSchema)
    .max(10, "That's plenty for now — you can add more later"),
});
export type IncomeStepFormValues = z.infer<typeof incomeStepFormSchema>;

export const incomeStepPayloadSchema = z.object({
  incomes: z
    .array(
      z.object({
        name: shortText("Name this income"),
        incomeType: z.enum(INCOME_TYPES),
        amount: positiveDollars,
        frequency: z.enum(INCOME_FREQUENCIES),
        visibility: z.enum(VISIBILITY_LEVELS),
      })
    )
    .max(10),
  bills: z
    .array(
      z.object({
        label: shortText("Name this bill"),
        category: z.enum(EXPENSE_CATEGORIES),
        amount: positiveDollars,
      })
    )
    .max(10),
  billsVisibility: z.enum(VISIBILITY_LEVELS),
});
export type IncomeStepPayload = z.infer<typeof incomeStepPayloadSchema>;

// ---------------------------------------------------------------------------
// Step 6 — debts
// ---------------------------------------------------------------------------

export const debtRowFormSchema = z.object({
  name: shortText("Name this debt"),
  debtType: z.enum(DEBT_TYPES),
  balance: requiredMoneyString,
  apr: moneyString.refine(
    (v) => v === "" || (Number(v) >= 0 && Number(v) <= 100),
    "APR is a percentage between 0 and 100"
  ),
  minimumPayment: moneyString,
  visibility: z.enum(VISIBILITY_LEVELS),
});
export const debtsStepFormSchema = z.object({
  debts: z
    .array(debtRowFormSchema)
    .max(10, "That's plenty for now — you can add more later"),
});
export type DebtsStepFormValues = z.infer<typeof debtsStepFormSchema>;

export const debtsStepPayloadSchema = z.object({
  debts: z
    .array(
      z.object({
        name: shortText("Name this debt"),
        debtType: z.enum(DEBT_TYPES),
        balance: positiveDollars,
        apr: z.number().finite().min(0).max(100),
        minimumPayment: dollars,
        visibility: z.enum(VISIBILITY_LEVELS),
      })
    )
    .max(10),
});
export type DebtsStepPayload = z.infer<typeof debtsStepPayloadSchema>;

// ---------------------------------------------------------------------------
// Step 7 — savings & emergency fund
// ---------------------------------------------------------------------------

export const savingsStepPayloadSchema = z
  .object({
    currentSavings: dollars,
    savingsVisibility: z.enum(VISIBILITY_LEVELS),
    monthlyEssentials: dollars,
    targetMonths: z.number().int().min(3).max(6),
    emergencyCurrentAmount: dollars,
    emergencyMonthlyContribution: dollars,
  })
  .refine(
    (d) =>
      (d.emergencyCurrentAmount === 0 &&
        d.emergencyMonthlyContribution === 0) ||
      d.monthlyEssentials > 0,
    {
      message:
        "Add a rough monthly essentials number so we can size your emergency fund",
      path: ["monthlyEssentials"],
    }
  );
export type SavingsStepPayload = z.infer<typeof savingsStepPayloadSchema>;

// ---------------------------------------------------------------------------
// Step 8 — investments
// ---------------------------------------------------------------------------

export const investmentRowFormSchema = z.object({
  name: shortText("Name this investment"),
  assetClass: z.enum(ASSET_CLASSES),
  currentValue: requiredMoneyString,
  riskLevel: z.enum(RISK_LEVELS),
  visibility: z.enum(VISIBILITY_LEVELS),
});
export const investmentsStepFormSchema = z.object({
  investments: z
    .array(investmentRowFormSchema)
    .max(10, "That's plenty for now — you can add more later"),
});
export type InvestmentsStepFormValues = z.infer<
  typeof investmentsStepFormSchema
>;

export const investmentsStepPayloadSchema = z.object({
  investments: z
    .array(
      z.object({
        name: shortText("Name this investment"),
        assetClass: z.enum(ASSET_CLASSES),
        currentValue: positiveDollars,
        riskLevel: z.enum(RISK_LEVELS),
        visibility: z.enum(VISIBILITY_LEVELS),
      })
    )
    .max(10),
});
export type InvestmentsStepPayload = z.infer<
  typeof investmentsStepPayloadSchema
>;

// ---------------------------------------------------------------------------
// Step 9 — shared goals
// ---------------------------------------------------------------------------

export const goalsStepPayloadSchema = z.object({
  goals: z
    .array(
      z.object({
        goalType: z.enum(SHARED_GOAL_TYPES as [GoalType, ...GoalType[]]),
        name: shortText("Name this goal"),
        targetAmount: positiveDollars,
        targetDate: z.iso.date("Pick a valid date").optional(),
      })
    )
    .max(8),
});
export type GoalsStepPayload = z.infer<typeof goalsStepPayloadSchema>;

// ---------------------------------------------------------------------------
// Step 10 — risk & priorities (finish)
// ---------------------------------------------------------------------------

export const finishStepPayloadSchema = z.object({
  riskComfort: z.number().int().min(1).max(5),
  stressNotes: z
    .string()
    .trim()
    .max(2000, "Keep it under 2000 characters")
    .optional(),
  priorities: z.array(z.string().trim().min(1).max(60)).max(12),
});
export type FinishStepPayload = z.infer<typeof finishStepPayloadSchema>;

// ---------------------------------------------------------------------------
// Skip / advance
// ---------------------------------------------------------------------------

export const skipStepSchema = z.object({
  step: z
    .number()
    .int()
    .min(0)
    .max(TOTAL_STEPS - 1),
});
export type SkipStepInput = z.infer<typeof skipStepSchema>;
