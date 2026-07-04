/**
 * Shared vocabulary for the onboarding wizard — plain module, safe to import
 * from both server actions and client components.
 */

import type {
  ExpenseCategory,
  GoalType,
  IncomeFrequency,
  IncomeType,
  MoneyStyle,
  RiskLevel,
} from "@/lib/constants";

/** The slice of the workspace the wizard needs on the client. */
export type WizardWorkspace = {
  id: string;
  name: string;
  role: "owner" | "partner";
  moneyStyle: MoneyStyle;
};

/** The slice of the profile the wizard needs for resume defaults. */
export type WizardProfile = {
  fullName: string | null;
  email: string;
  currency: string;
  moneyStylePref: MoneyStyle | null;
  sharePersonalNetWorth: boolean;
  riskComfort: number | null;
  stressNotes: string | null;
  priorities: string[] | null;
};

/** A pending partner invite the wizard can show/copy on the invite step. */
export type WizardInvite = {
  url: string;
  email: string;
};

export const TOTAL_STEPS = 11;

export const STEP_TITLES: readonly string[] = [
  "About you",
  "Your couple space",
  "Invite your partner",
  "Money style",
  "Privacy",
  "Income & bills",
  "Debts",
  "Savings",
  "Investments",
  "Shared goals",
  "Priorities",
];

export const CURRENCY_OPTIONS: ReadonlyArray<{ code: string; label: string }> =
  [
    { code: "USD", label: "US Dollar ($)" },
    { code: "EUR", label: "Euro (€)" },
    { code: "GBP", label: "British Pound (£)" },
    { code: "CAD", label: "Canadian Dollar (C$)" },
    { code: "AUD", label: "Australian Dollar (A$)" },
    { code: "INR", label: "Indian Rupee (₹)" },
    { code: "JPY", label: "Japanese Yen (¥)" },
  ];

export const FIXED_EXPENSE_PRESETS: ReadonlyArray<{
  key: string;
  label: string;
  category: ExpenseCategory;
}> = [
  { key: "rent", label: "Rent / mortgage", category: "housing" },
  { key: "utilities", label: "Utilities", category: "utilities" },
  { key: "phone", label: "Phone & internet", category: "utilities" },
  { key: "subscriptions", label: "Subscriptions", category: "subscriptions" },
  { key: "insurance", label: "Insurance", category: "insurance" },
];

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: "Salary",
  freelance: "Freelance",
  business: "Business",
  investment: "Investment income",
  rental: "Rental income",
  other: "Other",
};

export const INCOME_FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
  annual: "Yearly",
  irregular: "Irregular",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Lower risk",
  medium: "Medium risk",
  high: "Higher risk",
};

export const GOAL_EMOJI: Record<GoalType, string> = {
  emergency_fund: "🛟",
  house: "🏡",
  wedding: "💍",
  travel: "✈️",
  baby: "🍼",
  car: "🚗",
  education: "🎓",
  retirement: "🌅",
  custom: "⭐",
};

/** Goal types offered on the shared-goals step (emergency fund has its own step). */
export const SHARED_GOAL_TYPES: readonly GoalType[] = [
  "house",
  "wedding",
  "travel",
  "baby",
  "car",
  "education",
  "retirement",
  "custom",
];

export const RISK_COMFORT_DESCRIPTIONS: Record<
  number,
  { label: string; description: string }
> = {
  1: {
    label: "Very cautious",
    description:
      "Keeping what you have feels most important. Steady beats speedy, and that's a perfectly good plan.",
  },
  2: {
    label: "Cautious",
    description:
      "You prefer predictable progress with only small surprises along the way.",
  },
  3: {
    label: "Balanced",
    description:
      "You're comfortable with some ups and downs in exchange for growth over time.",
  },
  4: {
    label: "Growth-minded",
    description:
      "You're okay with meaningful swings while aiming for long-term growth.",
  },
  5: {
    label: "Very comfortable",
    description:
      "Short-term dips don't faze you — you're focused on the long run.",
  },
};

export const PRIORITY_OPTIONS: readonly string[] = [
  "Pay off debt",
  "Build savings",
  "Buy a home",
  "Invest more",
  "Travel",
  "Plan for family",
  "Retire early",
];
