import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Car,
  CircleEllipsis,
  Clapperboard,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  housing: Home,
  utilities: Zap,
  groceries: ShoppingCart,
  dining: UtensilsCrossed,
  transport: Car,
  health: HeartPulse,
  insurance: ShieldCheck,
  childcare: Baby,
  pets: PawPrint,
  entertainment: Clapperboard,
  travel: Plane,
  shopping: ShoppingBag,
  personal_care: Sparkles,
  subscriptions: Repeat,
  education: GraduationCap,
  gifts: Gift,
  debt_payment: CreditCard,
  savings: PiggyBank,
  other: CircleEllipsis,
};

export interface CategoryBadgeProps {
  category: ExpenseCategory;
  className?: string;
}

/** Expense category badge: icon + label from EXPENSE_CATEGORY_LABELS. */
export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const Icon = CATEGORY_ICONS[category];

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon aria-hidden />
      {EXPENSE_CATEGORY_LABELS[category]}
    </Badge>
  );
}
