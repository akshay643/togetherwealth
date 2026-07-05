"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MoneyInput } from "@/components/shared/money-input";
import { VisibilitySelect } from "@/components/shared/visibility-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASSES,
  CHECKIN_STATUSES,
  DECISION_TYPE_LABELS,
  DECISION_TYPES,
  DEBT_TYPE_LABELS,
  DEBT_TYPES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORIES,
  DOCUMENTS_BUCKET,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPES,
  GOAL_TYPE_LABELS,
  GOAL_TYPES,
  RECURRENCE_FREQUENCIES,
  RESEARCH_STATUSES,
  RISK_LEVELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type AssetClass,
  type CheckinStatus,
  type DebtType,
  type DecisionType,
  type DocumentCategory,
  type ExpenseCategory,
  type ExpenseType,
  type GoalType,
  type RecurrenceFrequency,
  type ResearchStatus,
  type RiskLevel,
  type TaskPriority,
  type TaskStatus,
  type Visibility,
} from "@/lib/constants";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  createBudgetAction,
  createDebtAction,
  createCheckinAction,
  createDocumentAction,
  createEmergencyFundAction,
  createExpenseAction,
  createGoalAction,
  createInvestmentAction,
  createResearchAction,
  createTaskAction,
  deleteBudgetAction,
  deleteBillPaymentAction,
  deleteCheckinAction,
  deleteDebtAction,
  deleteDocumentAction,
  deleteExpenseAction,
  deleteGoalAction,
  deleteInvestmentAction,
  deleteResearchAction,
  deleteTaskAction,
  saveBillPaymentAction,
  updateBudgetAction,
  updateCheckinAction,
  updateDebtAction,
  updateDocumentAction,
  updateExpenseAction,
  updateGoalAction,
  updateInvestmentAction,
  updateResearchAction,
  updateTaskAction,
} from "../actions";

type SectionActionsProps = {
  section: string;
  today: string;
  currentMonth: string;
  currency: string;
  workspaceId: string;
  userId: string;
  members: MemberOption[];
  readOnly?: boolean;
};

type ActionResult = { error: string } | { success: true };

type MemberOption = {
  id: string;
  label: string;
};

type ExpenseActionRow = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  expense_type: ExpenseType;
  visibility: Visibility;
  is_recurring: boolean;
  recurrence: RecurrenceFrequency | null;
  merchant: string | null;
  notes: string | null;
};

type BudgetActionRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  month: string;
  scope: "household" | "personal";
  visibility: Visibility;
  rollover: boolean;
};

type DebtActionRow = {
  id: string;
  name: string;
  debt_type: DebtType;
  balance: number;
  apr: number;
  minimum_payment: number;
  due_day: number | null;
  visibility: Visibility;
  notes: string | null;
};

type GoalActionRow = {
  id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  target_date: string | null;
  monthly_contribution: number | null;
  visibility: Visibility;
  emoji: string | null;
  notes: string | null;
};

type InvestmentActionRow = {
  id: string;
  name: string;
  asset_class: AssetClass;
  account_name: string | null;
  risk_level: RiskLevel | null;
  visibility: Visibility;
  is_watchlist: boolean;
  notes: string | null;
};

type InvestmentHoldingActionRow = {
  id: string;
  symbol: string | null;
  name: string;
  quantity: number | null;
  cost_basis: number | null;
  current_value: number;
  as_of: string | null;
  notes: string | null;
};

type ResearchActionRow = {
  id: string;
  title: string;
  decision_type: DecisionType;
  notes: string | null;
  pros: string[];
  cons: string[];
  estimated_cost: number | null;
  final_decision: string | null;
  status: ResearchStatus;
  visibility: Visibility;
};

type CheckinActionRow = {
  id: string;
  month: string;
  title: string | null;
  status: CheckinStatus;
  scheduled_for: string | null;
  summary: string | null;
};

type DocumentActionRow = {
  id: string;
  name: string;
  category: DocumentCategory;
  visibility: Visibility;
  expires_on: string | null;
  reminder_on: string | null;
  notes: string | null;
};

type TaskActionRow = {
  id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_on: string | null;
  status: TaskStatus;
  priority: TaskPriority;
};

type BillPaymentActionRow = {
  id: string;
  paid_on: string;
  amount: number;
  note: string | null;
} | null;

const VISIBILITY_DEFAULT: Visibility = "shared";

function amountOf(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function optionalAmountOf(value: string): number | null {
  if (!value.trim()) return null;
  return amountOf(value);
}

function quantityOf(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function linesOf(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "document";
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function FieldBlock({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={`space-y-1.5 ${className}`}>{children}</div>;
}

function SubmitButton({
  pending,
  children,
}: Readonly<{ pending: boolean; children: React.ReactNode }>) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
      {children}
    </Button>
  );
}

function AddDialogButton({
  label,
  children,
  open,
  onOpenChange,
}: Readonly<{
  label: string;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      {children}
    </Dialog>
  );
}

function ExpenseDialog({
  today,
  currency,
}: {
  today: string;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("groceries");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseType, setExpenseType] = useState<ExpenseType>("shared");
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("monthly");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setDescription("");
    setAmount("");
    setCategory("groceries");
    setExpenseDate(today);
    setExpenseType("shared");
    setVisibility(VISIBILITY_DEFAULT);
    setIsRecurring(false);
    setRecurrence("monthly");
    setMerchant("");
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createExpenseAction({
      description,
      amount: amountOf(amount),
      category,
      expenseDate,
      expenseType,
      visibility,
      isRecurring,
      recurrence: isRecurring ? recurrence : undefined,
      merchant,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Expense added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add expense" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Record a bill, purchase, or recurring cost.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldBlock>
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Groceries"
              maxLength={100}
              required
            />
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="expense-amount">Amount</Label>
              <MoneyInput
                id="expense-amount"
                value={amount}
                onChange={setAmount}
                currency={currency}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="expense-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as ExpenseCategory)}
              >
                <SelectTrigger id="expense-category" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {EXPENSE_CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="expense-type">Type</Label>
              <Select
                value={expenseType}
                onValueChange={(value) => setExpenseType(value as ExpenseType)}
              >
                <SelectTrigger id="expense-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label htmlFor="expense-merchant">Merchant</Label>
            <Input
              id="expense-merchant"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              placeholder="Optional"
              maxLength={100}
            />
          </FieldBlock>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="expense-recurring"
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked === true)}
            />
            <Label htmlFor="expense-recurring" className="flex-1">
              Recurring
            </Label>
            {isRecurring ? (
              <Select
                value={recurrence}
                onValueChange={(value) =>
                  setRecurrence(value as RecurrenceFrequency)
                }
              >
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_FREQUENCIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <FieldBlock>
            <Label>Visibility</Label>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save expense</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function BudgetDialog({
  currentMonth,
  currency,
}: {
  currentMonth: string;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("groceries");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [scope, setScope] = useState<"household" | "personal">("household");
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [rollover, setRollover] = useState(false);

  function reset() {
    setCategory("groceries");
    setAmount("");
    setMonth(currentMonth);
    setScope("household");
    setVisibility(VISIBILITY_DEFAULT);
    setRollover(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createBudgetAction({
      category,
      amount: amountOf(amount),
      month,
      scope,
      visibility,
      rollover,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Budget added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add budget" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add budget</DialogTitle>
          <DialogDescription>
            Set a monthly amount for one spending category.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="budget-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as ExpenseCategory)}
              >
                <SelectTrigger id="budget-category" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {EXPENSE_CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="budget-month">Month</Label>
              <Input
                id="budget-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
              />
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label htmlFor="budget-amount">Amount</Label>
            <MoneyInput
              id="budget-amount"
              value={amount}
              onChange={setAmount}
              currency={currency}
            />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="budget-scope">Scope</Label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as "household" | "personal")}
            >
              <SelectTrigger id="budget-scope" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="household">Household</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </FieldBlock>
          {scope === "personal" ? (
            <FieldBlock>
              <Label>Visibility</Label>
              <VisibilitySelect value={visibility} onChange={setVisibility} />
            </FieldBlock>
          ) : null}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="budget-rollover"
              checked={rollover}
              onCheckedChange={(checked) => setRollover(checked === true)}
            />
            <Label htmlFor="budget-rollover" className="flex-1">
              Roll unused amount forward
            </Label>
          </div>
          <DialogFooter>
            <SubmitButton pending={pending}>Save budget</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function DebtDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [debtType, setDebtType] = useState<DebtType>("credit_card");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [notes, setNotes] = useState("");

  function reset() {
    setName("");
    setDebtType("credit_card");
    setBalance("");
    setApr("");
    setMinimumPayment("");
    setDueDay("");
    setVisibility(VISIBILITY_DEFAULT);
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createDebtAction({
      name,
      debtType,
      balance: amountOf(balance),
      apr: amountOf(apr),
      minimumPayment: amountOf(minimumPayment),
      dueDay: dueDay ? Number(dueDay) : null,
      visibility,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Debt added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add debt" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add debt</DialogTitle>
          <DialogDescription>
            Track a balance, interest rate, and monthly minimum.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="debt-name">Name</Label>
              <Input
                id="debt-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Credit card"
                maxLength={100}
                required
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="debt-type">Type</Label>
              <Select
                value={debtType}
                onValueChange={(value) => setDebtType(value as DebtType)}
              >
                <SelectTrigger id="debt-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEBT_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {DEBT_TYPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="debt-balance">Balance</Label>
              <MoneyInput
                id="debt-balance"
                value={balance}
                onChange={setBalance}
                currency={currency}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="debt-minimum">Monthly minimum</Label>
              <MoneyInput
                id="debt-minimum"
                value={minimumPayment}
                onChange={setMinimumPayment}
                currency={currency}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="debt-apr">APR %</Label>
              <Input
                id="debt-apr"
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={apr}
                onChange={(event) => setApr(event.target.value)}
                placeholder="0"
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="debt-due-day">Due day</Label>
              <Input
                id="debt-due-day"
                type="number"
                min="1"
                max="31"
                inputMode="numeric"
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
                placeholder="Optional"
              />
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label>Visibility</Label>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="debt-notes">Notes</Label>
            <Textarea
              id="debt-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save debt</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function GoalDialog({
  coupleOnly,
  currency,
}: {
  coupleOnly: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("custom");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(
    coupleOnly ? "shared" : VISIBILITY_DEFAULT
  );
  const [emoji, setEmoji] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setName("");
    setGoalType("custom");
    setTargetAmount("");
    setTargetDate("");
    setMonthlyContribution("");
    setVisibility(coupleOnly ? "shared" : VISIBILITY_DEFAULT);
    setEmoji("");
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createGoalAction({
      name,
      goalType,
      targetAmount: amountOf(targetAmount),
      targetDate,
      monthlyContribution: amountOf(monthlyContribution),
      visibility,
      emoji,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Goal added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add goal" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add goal</DialogTitle>
          <DialogDescription>
            Create a savings target for yourself or the household.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-[1fr_5rem]">
            <FieldBlock>
              <Label htmlFor="goal-name">Name</Label>
              <Input
                id="goal-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Vacation"
                maxLength={100}
                required
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="goal-emoji">Icon</Label>
              <Input
                id="goal-emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="*"
                maxLength={8}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="goal-type">Type</Label>
              <Select
                value={goalType}
                onValueChange={(value) => setGoalType(value as GoalType)}
              >
                <SelectTrigger id="goal-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {GOAL_TYPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="goal-target-date">Target date</Label>
              <Input
                id="goal-target-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="goal-target-amount">Target amount</Label>
              <MoneyInput
                id="goal-target-amount"
                value={targetAmount}
                onChange={setTargetAmount}
                currency={currency}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="goal-monthly">Monthly contribution</Label>
              <MoneyInput
                id="goal-monthly"
                value={monthlyContribution}
                onChange={setMonthlyContribution}
                placeholder="Optional"
                currency={currency}
              />
            </FieldBlock>
          </div>
          {!coupleOnly ? (
            <FieldBlock>
              <Label>Visibility</Label>
              <VisibilitySelect value={visibility} onChange={setVisibility} />
            </FieldBlock>
          ) : null}
          <FieldBlock>
            <Label htmlFor="goal-notes">Notes</Label>
            <Textarea
              id="goal-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save goal</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function InvestmentDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("etf");
  const [accountName, setAccountName] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "none">("none");
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const [holdingName, setHoldingName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [asOf, setAsOf] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setName("");
    setAssetClass("etf");
    setAccountName("");
    setRiskLevel("none");
    setVisibility(VISIBILITY_DEFAULT);
    setIsWatchlist(false);
    setHoldingName("");
    setSymbol("");
    setQuantity("");
    setCostBasis("");
    setCurrentValue("");
    setAsOf("");
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createInvestmentAction({
      name,
      assetClass,
      accountName,
      riskLevel: riskLevel === "none" ? null : riskLevel,
      visibility,
      isWatchlist,
      holdingName: holdingName || name,
      symbol,
      quantity: quantityOf(quantity),
      costBasis: optionalAmountOf(costBasis),
      currentValue: amountOf(currentValue),
      asOf,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Investment added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add investment" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add investment</DialogTitle>
          <DialogDescription>
            Track an investment account, holding, or watchlist item.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="investment-name">Investment name</Label>
              <Input
                id="investment-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Brokerage account"
                maxLength={100}
                required
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="investment-asset-class">Asset class</Label>
              <Select
                value={assetClass}
                onValueChange={(value) => setAssetClass(value as AssetClass)}
              >
                <SelectTrigger
                  id="investment-asset-class"
                  className="h-11 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CLASSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ASSET_CLASS_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="investment-holding">Holding name</Label>
              <Input
                id="investment-holding"
                value={holdingName}
                onChange={(event) => setHoldingName(event.target.value)}
                placeholder="Same as investment"
                maxLength={100}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="investment-symbol">Symbol</Label>
              <Input
                id="investment-symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="Optional"
                maxLength={20}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="investment-current-value">Current value</Label>
              <MoneyInput
                id="investment-current-value"
                value={currentValue}
                onChange={setCurrentValue}
                currency={currency}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="investment-cost-basis">Cost basis</Label>
              <MoneyInput
                id="investment-cost-basis"
                value={costBasis}
                onChange={setCostBasis}
                placeholder="Optional"
                currency={currency}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="investment-quantity">Quantity</Label>
              <Input
                id="investment-quantity"
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Optional"
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="investment-as-of">Value date</Label>
              <Input
                id="investment-as-of"
                type="date"
                value={asOf}
                onChange={(event) => setAsOf(event.target.value)}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="investment-account">Account name</Label>
              <Input
                id="investment-account"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Optional"
                maxLength={100}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="investment-risk">Risk level</Label>
              <Select
                value={riskLevel}
                onValueChange={(value) =>
                  setRiskLevel(value as RiskLevel | "none")
                }
              >
                <SelectTrigger id="investment-risk" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {RISK_LEVELS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {titleCase(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="investment-watchlist"
              checked={isWatchlist}
              onCheckedChange={(checked) => setIsWatchlist(checked === true)}
            />
            <Label htmlFor="investment-watchlist" className="flex-1">
              Watchlist only
            </Label>
          </div>
          <FieldBlock>
            <Label>Visibility</Label>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="investment-notes">Notes</Label>
            <Textarea
              id="investment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save investment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function EmergencyFundDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("Emergency fund");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentSavings, setCurrentSavings] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [notes, setNotes] = useState("");

  function reset() {
    setName("Emergency fund");
    setTargetAmount("");
    setCurrentSavings("");
    setTargetDate("");
    setMonthlyContribution("");
    setVisibility(VISIBILITY_DEFAULT);
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createEmergencyFundAction({
      name,
      targetAmount: amountOf(targetAmount),
      currentSavings: amountOf(currentSavings),
      targetDate,
      monthlyContribution: amountOf(monthlyContribution),
      visibility,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Emergency fund added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add fund" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add emergency fund</DialogTitle>
          <DialogDescription>
            Create a cash cushion goal and optional starting balance.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldBlock>
            <Label htmlFor="emergency-name">Name</Label>
            <Input
              id="emergency-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="emergency-target">Target amount</Label>
              <MoneyInput
                id="emergency-target"
                value={targetAmount}
                onChange={setTargetAmount}
                currency={currency}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="emergency-current">Saved so far</Label>
              <MoneyInput
                id="emergency-current"
                value={currentSavings}
                onChange={setCurrentSavings}
                placeholder="Optional"
                currency={currency}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="emergency-date">Target date</Label>
              <Input
                id="emergency-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="emergency-monthly">Monthly contribution</Label>
              <MoneyInput
                id="emergency-monthly"
                value={monthlyContribution}
                onChange={setMonthlyContribution}
                placeholder="Optional"
                currency={currency}
              />
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label>Visibility</Label>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="emergency-notes">Notes</Label>
            <Textarea
              id="emergency-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save fund</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function ResearchDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [decisionType, setDecisionType] = useState<DecisionType>("custom");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle("");
    setDecisionType("custom");
    setEstimatedCost("");
    setPros("");
    setCons("");
    setVisibility(VISIBILITY_DEFAULT);
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createResearchAction({
      title,
      decisionType,
      estimatedCost: optionalAmountOf(estimatedCost),
      pros: linesOf(pros),
      cons: linesOf(cons),
      visibility,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Research added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add research" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add research</DialogTitle>
          <DialogDescription>
            Capture a money decision, cost estimate, pros, and cons.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldBlock>
            <Label htmlFor="research-title">Title</Label>
            <Input
              id="research-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Buy a car or keep renting?"
              maxLength={100}
              required
            />
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="research-type">Decision type</Label>
              <Select
                value={decisionType}
                onValueChange={(value) => setDecisionType(value as DecisionType)}
              >
                <SelectTrigger id="research-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {DECISION_TYPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="research-cost">Estimated cost</Label>
              <MoneyInput
                id="research-cost"
                value={estimatedCost}
                onChange={setEstimatedCost}
                placeholder="Optional"
                currency={currency}
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="research-pros">Pros</Label>
              <Textarea
                id="research-pros"
                value={pros}
                onChange={(event) => setPros(event.target.value)}
                placeholder="One per line"
                maxLength={500}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="research-cons">Cons</Label>
              <Textarea
                id="research-cons"
                value={cons}
                onChange={(event) => setCons(event.target.value)}
                placeholder="One per line"
                maxLength={500}
              />
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label>Visibility</Label>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="research-notes">Notes</Label>
            <Textarea
              id="research-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save research</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function CheckinDialog({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [title, setTitle] = useState("Monthly money check-in");
  const [scheduledFor, setScheduledFor] = useState("");
  const [summary, setSummary] = useState("");

  function reset() {
    setMonth(currentMonth);
    setTitle("Monthly money check-in");
    setScheduledFor("");
    setSummary("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createCheckinAction({
      month,
      title,
      scheduledFor,
      summary,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Check-in added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add check-in" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add check-in</DialogTitle>
          <DialogDescription>
            Start a monthly money conversation for the workspace.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="checkin-month">Month</Label>
              <Input
                id="checkin-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="checkin-scheduled">Scheduled date</Label>
              <Input
                id="checkin-scheduled"
                type="date"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label htmlFor="checkin-title">Title</Label>
            <Input
              id="checkin-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
            />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="checkin-summary">Notes</Label>
            <Textarea
              id="checkin-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save check-in</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function DocumentDialog({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<Visibility>(VISIBILITY_DEFAULT);
  const [expiresOn, setExpiresOn] = useState("");
  const [reminderOn, setReminderOn] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setName("");
    setCategory("other");
    setFile(null);
    setVisibility(VISIBILITY_DEFAULT);
    setExpiresOn("");
    setReminderOn("");
    setNotes("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Documents can be up to 20 MB.");
      return;
    }

    setPending(true);
    const supabase = createBrowserClient();
    const storagePath = `${workspaceId}/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      toast.error(uploadError.message || "The file could not be uploaded.");
      setPending(false);
      return;
    }

    const result: ActionResult = await createDocumentAction({
      name: name || file.name,
      category,
      storagePath,
      fileSize: file.size,
      mimeType: file.type || null,
      visibility,
      expiresOn,
      reminderOn,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      toast.error(result.error);
      return;
    }
    toast.success("Document added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add document" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            Upload a record and add reminders or expiry dates.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldBlock>
            <Label htmlFor="document-file">File</Label>
            <Input
              id="document-file"
              type="file"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                if (nextFile && !name) setName(nextFile.name);
              }}
              required
            />
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="document-name">Name</Label>
              <Input
                id="document-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="document-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as DocumentCategory)}
              >
                <SelectTrigger id="document-category" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {DOCUMENT_CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="document-reminder">Reminder</Label>
              <Input
                id="document-reminder"
                type="date"
                value={reminderOn}
                onChange={(event) => setReminderOn(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="document-expires">Expires</Label>
              <Input
                id="document-expires"
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
              />
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label>Visibility</Label>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="document-notes">Notes</Label>
            <Textarea
              id="document-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save document</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function TaskDialog({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  function reset() {
    setTitle("");
    setDescription("");
    setAssignedTo("unassigned");
    setDueOn("");
    setPriority("medium");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result: ActionResult = await createTaskAction({
      title,
      description,
      assignedTo: assignedTo === "unassigned" ? null : assignedTo,
      dueOn,
      priority,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Task added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <AddDialogButton label="Add task" open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            Create a follow-up and assign it to a workspace member.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldBlock>
            <Label htmlFor="task-title">Task</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Review insurance renewal"
              maxLength={100}
              required
            />
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock>
              <Label htmlFor="task-assignee">Assigned to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="task-assignee" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger id="task-priority" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {titleCase(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <FieldBlock>
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
            />
          </FieldBlock>
          <FieldBlock>
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              maxLength={500}
            />
          </FieldBlock>
          <DialogFooter>
            <SubmitButton pending={pending}>Save task</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </AddDialogButton>
  );
}

function amountString(value: number | null | undefined): string {
  return value && Number.isFinite(value) ? String(value) : "";
}

function RowActionButton({
  children,
  onClick,
}: Readonly<{ children: React.ReactNode; onClick?: () => void }>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function DeleteButton({
  label,
  title = "Delete this item?",
  description,
  buttonLabel = "Delete",
  confirmLabel = "Delete",
  onDelete,
}: Readonly<{
  label: string;
  title?: string;
  description: string;
  buttonLabel?: string;
  confirmLabel?: string;
  onDelete: () => Promise<ActionResult>;
}>) {
  const router = useRouter();

  async function handleDelete() {
    const result = await onDelete();
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(label);
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {buttonLabel}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive
      onConfirm={handleDelete}
    />
  );
}

export function BillPaymentActions({
  expenseId,
  description,
  month,
  defaultAmount,
  currency,
  payment,
  canManage,
}: {
  expenseId: string;
  description: string;
  month: string;
  defaultAmount: number;
  currency: string;
  payment: BillPaymentActionRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [paidOn, setPaidOn] = useState(
    payment?.paid_on ?? new Date().toISOString().slice(0, 10)
  );
  const [amount, setAmount] = useState(
    amountString(payment?.amount ?? defaultAmount)
  );
  const [note, setNote] = useState(payment?.note ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await saveBillPaymentAction({
      expenseId,
      month,
      paidOn,
      amount: amountOf(amount),
      note,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Bill payment saved");
    setOpen(false);
    router.refresh();
  }

  if (!canManage) {
    return (
      <div className="flex justify-end">
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <RowActionButton>
            {payment ? (
              <Pencil className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            {payment ? "Edit" : "Paid"}
          </RowActionButton>
        </DialogTrigger>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {payment ? "Edit bill payment" : "Mark bill paid"}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`bill-paid-on-${expenseId}`}>Paid date</Label>
                <Input
                  id={`bill-paid-on-${expenseId}`}
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  required
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`bill-amount-${expenseId}`}>Amount</Label>
                <MoneyInput
                  id={`bill-amount-${expenseId}`}
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                />
              </FieldBlock>
            </div>
            <FieldBlock>
              <Label htmlFor={`bill-note-${expenseId}`}>Note</Label>
              <Textarea
                id={`bill-note-${expenseId}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional"
                maxLength={500}
              />
            </FieldBlock>
            <DialogFooter>
              <SubmitButton pending={pending}>Save payment</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {payment ? (
        <DeleteButton
          label="Bill marked unpaid"
          title="Mark this bill unpaid?"
          description="This removes the paid marker for this bill month. The recurring bill itself remains."
          buttonLabel="Unpaid"
          confirmLabel="Mark unpaid"
          onDelete={() => deleteBillPaymentAction({ expenseId, month })}
        />
      ) : null}
    </div>
  );
}

export function ExpenseRowActions({
  expense,
  canManage,
  currency,
}: {
  expense: ExpenseActionRow;
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(amountString(expense.amount));
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [expenseDate, setExpenseDate] = useState(expense.expense_date);
  const [expenseType, setExpenseType] = useState<ExpenseType>(
    expense.expense_type
  );
  const [visibility, setVisibility] = useState<Visibility>(expense.visibility);
  const [isRecurring, setIsRecurring] = useState(expense.is_recurring);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>(
    expense.recurrence ?? "monthly"
  );
  const [merchant, setMerchant] = useState(expense.merchant ?? "");
  const [notes, setNotes] = useState(expense.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateExpenseAction({
      id: expense.id,
      description,
      amount: amountOf(amount),
      category,
      expenseDate,
      expenseType,
      visibility,
      isRecurring,
      recurrence: isRecurring ? recurrence : undefined,
      merchant,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Expense updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <RowActionButton>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </RowActionButton>
        </DialogTrigger>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
            <DialogDescription>Update the expense details.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <FieldBlock>
              <Label htmlFor={`expense-description-${expense.id}`}>
                Description
              </Label>
              <Input
                id={`expense-description-${expense.id}`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={100}
                required
              />
            </FieldBlock>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`expense-amount-${expense.id}`}>Amount</Label>
                <MoneyInput
                  id={`expense-amount-${expense.id}`}
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`expense-date-${expense.id}`}>Date</Label>
                <Input
                  id={`expense-date-${expense.id}`}
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  required
                />
              </FieldBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`expense-category-${expense.id}`}>
                  Category
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as ExpenseCategory)
                  }
                >
                  <SelectTrigger
                    id={`expense-category-${expense.id}`}
                    className="h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {EXPENSE_CATEGORY_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`expense-type-${expense.id}`}>Type</Label>
                <Select
                  value={expenseType}
                  onValueChange={(value) => setExpenseType(value as ExpenseType)}
                >
                  <SelectTrigger
                    id={`expense-type-${expense.id}`}
                    className="h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
            </div>
            <FieldBlock>
              <Label htmlFor={`expense-merchant-${expense.id}`}>Merchant</Label>
              <Input
                id={`expense-merchant-${expense.id}`}
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
                maxLength={100}
              />
            </FieldBlock>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id={`expense-recurring-${expense.id}`}
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
              />
              <Label htmlFor={`expense-recurring-${expense.id}`} className="flex-1">
                Recurring
              </Label>
              {isRecurring ? (
                <Select
                  value={recurrence}
                  onValueChange={(value) =>
                    setRecurrence(value as RecurrenceFrequency)
                  }
                >
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_FREQUENCIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            <FieldBlock>
              <Label>Visibility</Label>
              <VisibilitySelect value={visibility} onChange={setVisibility} />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor={`expense-notes-${expense.id}`}>Notes</Label>
              <Textarea
                id={`expense-notes-${expense.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
              />
            </FieldBlock>
            <DialogFooter>
              <SubmitButton pending={pending}>Save changes</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteButton
        label="Expense deleted"
        description="This removes the expense from spending, cash flow, and budget totals."
        onDelete={() => deleteExpenseAction({ id: expense.id })}
      />
        </>
      )}
    </div>
  );
}

export function BudgetRowActions({
  budget,
  canManage,
  currency,
}: {
  budget: BudgetActionRow;
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>(budget.category);
  const [amount, setAmount] = useState(amountString(budget.amount));
  const [month, setMonth] = useState(budget.month.slice(0, 7));
  const [scope, setScope] = useState<"household" | "personal">(budget.scope);
  const [visibility, setVisibility] = useState<Visibility>(budget.visibility);
  const [rollover, setRollover] = useState(budget.rollover);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateBudgetAction({
      id: budget.id,
      category,
      amount: amountOf(amount),
      month,
      scope,
      visibility,
      rollover,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Budget updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <RowActionButton>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </RowActionButton>
        </DialogTrigger>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit budget</DialogTitle>
            <DialogDescription>Update this monthly plan.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`budget-category-${budget.id}`}>Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as ExpenseCategory)
                  }
                >
                  <SelectTrigger
                    id={`budget-category-${budget.id}`}
                    className="h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {EXPENSE_CATEGORY_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`budget-month-${budget.id}`}>Month</Label>
                <Input
                  id={`budget-month-${budget.id}`}
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  required
                />
              </FieldBlock>
            </div>
            <FieldBlock>
              <Label htmlFor={`budget-amount-${budget.id}`}>Amount</Label>
              <MoneyInput
                id={`budget-amount-${budget.id}`}
                value={amount}
                onChange={setAmount}
                currency={currency}
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor={`budget-scope-${budget.id}`}>Scope</Label>
              <Select
                value={scope}
                onValueChange={(value) =>
                  setScope(value as "household" | "personal")
                }
              >
                <SelectTrigger
                  id={`budget-scope-${budget.id}`}
                  className="h-11 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="household">Household</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </FieldBlock>
            {scope === "personal" ? (
              <FieldBlock>
                <Label>Visibility</Label>
                <VisibilitySelect value={visibility} onChange={setVisibility} />
              </FieldBlock>
            ) : null}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id={`budget-rollover-${budget.id}`}
                checked={rollover}
                onCheckedChange={(checked) => setRollover(checked === true)}
              />
              <Label htmlFor={`budget-rollover-${budget.id}`} className="flex-1">
                Roll unused amount forward
              </Label>
            </div>
            <DialogFooter>
              <SubmitButton pending={pending}>Save changes</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteButton
        label="Budget deleted"
        description="This removes the monthly budget row. Expenses remain untouched."
        onDelete={() => deleteBudgetAction({ id: budget.id })}
      />
        </>
      )}
    </div>
  );
}

export function DebtRowActions({
  debt,
  canManage,
  currency,
}: {
  debt: DebtActionRow;
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(debt.name);
  const [debtType, setDebtType] = useState<DebtType>(debt.debt_type);
  const [balance, setBalance] = useState(amountString(debt.balance));
  const [apr, setApr] = useState(amountString(debt.apr));
  const [minimumPayment, setMinimumPayment] = useState(
    amountString(debt.minimum_payment)
  );
  const [dueDay, setDueDay] = useState(debt.due_day ? String(debt.due_day) : "");
  const [visibility, setVisibility] = useState<Visibility>(debt.visibility);
  const [notes, setNotes] = useState(debt.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateDebtAction({
      id: debt.id,
      name,
      debtType,
      balance: amountOf(balance),
      apr: amountOf(apr),
      minimumPayment: amountOf(minimumPayment),
      dueDay: dueDay ? Number(dueDay) : null,
      visibility,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Debt updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <RowActionButton>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </RowActionButton>
        </DialogTrigger>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit debt</DialogTitle>
            <DialogDescription>Update this balance and payoff data.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`debt-name-${debt.id}`}>Name</Label>
                <Input
                  id={`debt-name-${debt.id}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`debt-type-${debt.id}`}>Type</Label>
                <Select
                  value={debtType}
                  onValueChange={(value) => setDebtType(value as DebtType)}
                >
                  <SelectTrigger
                    id={`debt-type-${debt.id}`}
                    className="h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEBT_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {DEBT_TYPE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`debt-balance-${debt.id}`}>Balance</Label>
                <MoneyInput
                  id={`debt-balance-${debt.id}`}
                  value={balance}
                  onChange={setBalance}
                  currency={currency}
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`debt-minimum-${debt.id}`}>
                  Monthly minimum
                </Label>
                <MoneyInput
                  id={`debt-minimum-${debt.id}`}
                  value={minimumPayment}
                  onChange={setMinimumPayment}
                  currency={currency}
                />
              </FieldBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`debt-apr-${debt.id}`}>APR %</Label>
                <Input
                  id={`debt-apr-${debt.id}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  value={apr}
                  onChange={(event) => setApr(event.target.value)}
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`debt-due-${debt.id}`}>Due day</Label>
                <Input
                  id={`debt-due-${debt.id}`}
                  type="number"
                  min="1"
                  max="31"
                  inputMode="numeric"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                />
              </FieldBlock>
            </div>
            <FieldBlock>
              <Label>Visibility</Label>
              <VisibilitySelect value={visibility} onChange={setVisibility} />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor={`debt-notes-${debt.id}`}>Notes</Label>
              <Textarea
                id={`debt-notes-${debt.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
              />
            </FieldBlock>
            <DialogFooter>
              <SubmitButton pending={pending}>Save changes</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteButton
        label="Debt deleted"
        description="This removes the debt and any payoff calculations based on it."
        onDelete={() => deleteDebtAction({ id: debt.id })}
      />
        </>
      )}
    </div>
  );
}

export function GoalRowActions({
  goal,
  coupleOnly = false,
  canManage,
  currency,
}: {
  goal: GoalActionRow;
  coupleOnly?: boolean;
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(goal.name);
  const [goalType, setGoalType] = useState<GoalType>(goal.goal_type);
  const [targetAmount, setTargetAmount] = useState(
    amountString(goal.target_amount)
  );
  const [targetDate, setTargetDate] = useState(goal.target_date ?? "");
  const [monthlyContribution, setMonthlyContribution] = useState(
    amountString(goal.monthly_contribution)
  );
  const [visibility, setVisibility] = useState<Visibility>(goal.visibility);
  const [emoji, setEmoji] = useState(goal.emoji ?? "");
  const [notes, setNotes] = useState(goal.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateGoalAction({
      id: goal.id,
      name,
      goalType,
      targetAmount: amountOf(targetAmount),
      targetDate,
      monthlyContribution: amountOf(monthlyContribution),
      visibility,
      emoji,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Goal updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <RowActionButton>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </RowActionButton>
        </DialogTrigger>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
            <DialogDescription>Update this savings target.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-[1fr_5rem]">
              <FieldBlock>
                <Label htmlFor={`goal-name-${goal.id}`}>Name</Label>
                <Input
                  id={`goal-name-${goal.id}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`goal-emoji-${goal.id}`}>Icon</Label>
                <Input
                  id={`goal-emoji-${goal.id}`}
                  value={emoji}
                  onChange={(event) => setEmoji(event.target.value)}
                  maxLength={8}
                />
              </FieldBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`goal-type-${goal.id}`}>Type</Label>
                <Select
                  value={goalType}
                  onValueChange={(value) => setGoalType(value as GoalType)}
                >
                  <SelectTrigger
                    id={`goal-type-${goal.id}`}
                    className="h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {GOAL_TYPE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`goal-date-${goal.id}`}>Target date</Label>
                <Input
                  id={`goal-date-${goal.id}`}
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                />
              </FieldBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBlock>
                <Label htmlFor={`goal-target-${goal.id}`}>Target amount</Label>
                <MoneyInput
                  id={`goal-target-${goal.id}`}
                  value={targetAmount}
                  onChange={setTargetAmount}
                  currency={currency}
                />
              </FieldBlock>
              <FieldBlock>
                <Label htmlFor={`goal-monthly-${goal.id}`}>
                  Monthly contribution
                </Label>
                <MoneyInput
                  id={`goal-monthly-${goal.id}`}
                  value={monthlyContribution}
                  onChange={setMonthlyContribution}
                  currency={currency}
                />
              </FieldBlock>
            </div>
            {!coupleOnly ? (
              <FieldBlock>
                <Label>Visibility</Label>
                <VisibilitySelect value={visibility} onChange={setVisibility} />
              </FieldBlock>
            ) : null}
            <FieldBlock>
              <Label htmlFor={`goal-notes-${goal.id}`}>Notes</Label>
              <Textarea
                id={`goal-notes-${goal.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
              />
            </FieldBlock>
            <DialogFooter>
              <SubmitButton pending={pending}>Save changes</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteButton
        label="Goal deleted"
        description="This removes the goal and its contribution history."
        onDelete={() => deleteGoalAction({ id: goal.id })}
      />
        </>
      )}
    </div>
  );
}

export function InvestmentRowActions({
  investment,
  holding,
  canManage,
  currency,
}: {
  investment: InvestmentActionRow;
  holding: InvestmentHoldingActionRow;
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(investment.name);
  const [assetClass, setAssetClass] = useState<AssetClass>(investment.asset_class);
  const [accountName, setAccountName] = useState(investment.account_name ?? "");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "none">(
    investment.risk_level ?? "none"
  );
  const [visibility, setVisibility] = useState<Visibility>(investment.visibility);
  const [isWatchlist, setIsWatchlist] = useState(investment.is_watchlist);
  const [holdingName, setHoldingName] = useState(holding.name);
  const [symbol, setSymbol] = useState(holding.symbol ?? "");
  const [quantity, setQuantity] = useState(amountString(holding.quantity));
  const [costBasis, setCostBasis] = useState(amountString(holding.cost_basis));
  const [currentValue, setCurrentValue] = useState(
    amountString(holding.current_value)
  );
  const [asOf, setAsOf] = useState(holding.as_of ?? "");
  const [notes, setNotes] = useState(investment.notes ?? holding.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateInvestmentAction({
      id: investment.id,
      holdingId: holding.id,
      name,
      assetClass,
      accountName,
      riskLevel: riskLevel === "none" ? null : riskLevel,
      visibility,
      isWatchlist,
      holdingName,
      symbol,
      quantity: quantityOf(quantity),
      costBasis: optionalAmountOf(costBasis),
      currentValue: amountOf(currentValue),
      asOf,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Investment updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <RowActionButton>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </RowActionButton>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit investment</DialogTitle>
                <DialogDescription>Update this investment and holding.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`investment-name-${investment.id}`}>
                      Investment name
                    </Label>
                    <Input
                      id={`investment-name-${investment.id}`}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={100}
                      required
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`investment-asset-${investment.id}`}>
                      Asset class
                    </Label>
                    <Select
                      value={assetClass}
                      onValueChange={(value) => setAssetClass(value as AssetClass)}
                    >
                      <SelectTrigger
                        id={`investment-asset-${investment.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_CLASSES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {ASSET_CLASS_LABELS[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`holding-name-${holding.id}`}>Holding</Label>
                    <Input
                      id={`holding-name-${holding.id}`}
                      value={holdingName}
                      onChange={(event) => setHoldingName(event.target.value)}
                      maxLength={100}
                      required
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`holding-symbol-${holding.id}`}>Symbol</Label>
                    <Input
                      id={`holding-symbol-${holding.id}`}
                      value={symbol}
                      onChange={(event) =>
                        setSymbol(event.target.value.toUpperCase())
                      }
                      maxLength={20}
                    />
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`holding-value-${holding.id}`}>
                      Current value
                    </Label>
                    <MoneyInput
                      id={`holding-value-${holding.id}`}
                      value={currentValue}
                      onChange={setCurrentValue}
                      currency={currency}
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`holding-cost-${holding.id}`}>
                      Cost basis
                    </Label>
                    <MoneyInput
                      id={`holding-cost-${holding.id}`}
                      value={costBasis}
                      onChange={setCostBasis}
                      currency={currency}
                    />
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`holding-quantity-${holding.id}`}>
                      Quantity
                    </Label>
                    <Input
                      id={`holding-quantity-${holding.id}`}
                      type="number"
                      min="0"
                      step="0.000001"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`holding-as-of-${holding.id}`}>Value date</Label>
                    <Input
                      id={`holding-as-of-${holding.id}`}
                      type="date"
                      value={asOf}
                      onChange={(event) => setAsOf(event.target.value)}
                    />
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`investment-account-${investment.id}`}>
                      Account
                    </Label>
                    <Input
                      id={`investment-account-${investment.id}`}
                      value={accountName}
                      onChange={(event) => setAccountName(event.target.value)}
                      maxLength={100}
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`investment-risk-${investment.id}`}>
                      Risk level
                    </Label>
                    <Select
                      value={riskLevel}
                      onValueChange={(value) =>
                        setRiskLevel(value as RiskLevel | "none")
                      }
                    >
                      <SelectTrigger
                        id={`investment-risk-${investment.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {RISK_LEVELS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {titleCase(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox
                    id={`investment-watchlist-${investment.id}`}
                    checked={isWatchlist}
                    onCheckedChange={(checked) => setIsWatchlist(checked === true)}
                  />
                  <Label
                    htmlFor={`investment-watchlist-${investment.id}`}
                    className="flex-1"
                  >
                    Watchlist only
                  </Label>
                </div>
                <FieldBlock>
                  <Label>Visibility</Label>
                  <VisibilitySelect value={visibility} onChange={setVisibility} />
                </FieldBlock>
                <FieldBlock>
                  <Label htmlFor={`investment-notes-${investment.id}`}>Notes</Label>
                  <Textarea
                    id={`investment-notes-${investment.id}`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={500}
                  />
                </FieldBlock>
                <DialogFooter>
                  <SubmitButton pending={pending}>Save changes</SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <DeleteButton
            label="Investment deleted"
            description="This removes the investment and its holdings."
            onDelete={() => deleteInvestmentAction({ id: investment.id })}
          />
        </>
      )}
    </div>
  );
}

export function ResearchRowActions({
  item,
  canManage,
  currency,
}: {
  item: ResearchActionRow;
  canManage: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [decisionType, setDecisionType] = useState<DecisionType>(
    item.decision_type
  );
  const [status, setStatus] = useState<ResearchStatus>(item.status);
  const [estimatedCost, setEstimatedCost] = useState(
    amountString(item.estimated_cost)
  );
  const [pros, setPros] = useState(item.pros.join("\n"));
  const [cons, setCons] = useState(item.cons.join("\n"));
  const [finalDecision, setFinalDecision] = useState(item.final_decision ?? "");
  const [visibility, setVisibility] = useState<Visibility>(item.visibility);
  const [notes, setNotes] = useState(item.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateResearchAction({
      id: item.id,
      title,
      decisionType,
      estimatedCost: optionalAmountOf(estimatedCost),
      pros: linesOf(pros),
      cons: linesOf(cons),
      status,
      finalDecision,
      visibility,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Research updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <RowActionButton>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </RowActionButton>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit research</DialogTitle>
                <DialogDescription>Update this money decision.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <FieldBlock>
                  <Label htmlFor={`research-title-${item.id}`}>Title</Label>
                  <Input
                    id={`research-title-${item.id}`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={100}
                    required
                  />
                </FieldBlock>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`research-type-${item.id}`}>Type</Label>
                    <Select
                      value={decisionType}
                      onValueChange={(value) =>
                        setDecisionType(value as DecisionType)
                      }
                    >
                      <SelectTrigger
                        id={`research-type-${item.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_TYPES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {DECISION_TYPE_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`research-status-${item.id}`}>Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as ResearchStatus)}
                    >
                      <SelectTrigger
                        id={`research-status-${item.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESEARCH_STATUSES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {titleCase(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                </div>
                <FieldBlock>
                  <Label htmlFor={`research-cost-${item.id}`}>Estimated cost</Label>
                  <MoneyInput
                    id={`research-cost-${item.id}`}
                    value={estimatedCost}
                    onChange={setEstimatedCost}
                    currency={currency}
                  />
                </FieldBlock>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`research-pros-${item.id}`}>Pros</Label>
                    <Textarea
                      id={`research-pros-${item.id}`}
                      value={pros}
                      onChange={(event) => setPros(event.target.value)}
                      maxLength={500}
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`research-cons-${item.id}`}>Cons</Label>
                    <Textarea
                      id={`research-cons-${item.id}`}
                      value={cons}
                      onChange={(event) => setCons(event.target.value)}
                      maxLength={500}
                    />
                  </FieldBlock>
                </div>
                <FieldBlock>
                  <Label htmlFor={`research-final-${item.id}`}>Decision</Label>
                  <Textarea
                    id={`research-final-${item.id}`}
                    value={finalDecision}
                    onChange={(event) => setFinalDecision(event.target.value)}
                    maxLength={500}
                  />
                </FieldBlock>
                <FieldBlock>
                  <Label>Visibility</Label>
                  <VisibilitySelect value={visibility} onChange={setVisibility} />
                </FieldBlock>
                <FieldBlock>
                  <Label htmlFor={`research-notes-${item.id}`}>Notes</Label>
                  <Textarea
                    id={`research-notes-${item.id}`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={500}
                  />
                </FieldBlock>
                <DialogFooter>
                  <SubmitButton pending={pending}>Save changes</SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <DeleteButton
            label="Research deleted"
            description="This removes the research item and its notes."
            onDelete={() => deleteResearchAction({ id: item.id })}
          />
        </>
      )}
    </div>
  );
}

export function CheckinRowActions({
  checkin,
  canManage,
}: {
  checkin: CheckinActionRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [month, setMonth] = useState(checkin.month.slice(0, 7));
  const [title, setTitle] = useState(checkin.title ?? "");
  const [status, setStatus] = useState<CheckinStatus>(checkin.status);
  const [scheduledFor, setScheduledFor] = useState(checkin.scheduled_for ?? "");
  const [summary, setSummary] = useState(checkin.summary ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateCheckinAction({
      id: checkin.id,
      month,
      title,
      status,
      scheduledFor,
      summary,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Check-in updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <RowActionButton>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </RowActionButton>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit check-in</DialogTitle>
                <DialogDescription>Update the money check-in.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`checkin-month-${checkin.id}`}>Month</Label>
                    <Input
                      id={`checkin-month-${checkin.id}`}
                      type="month"
                      value={month}
                      onChange={(event) => setMonth(event.target.value)}
                      required
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`checkin-status-${checkin.id}`}>Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as CheckinStatus)}
                    >
                      <SelectTrigger
                        id={`checkin-status-${checkin.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECKIN_STATUSES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {titleCase(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                </div>
                <FieldBlock>
                  <Label htmlFor={`checkin-title-${checkin.id}`}>Title</Label>
                  <Input
                    id={`checkin-title-${checkin.id}`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={100}
                  />
                </FieldBlock>
                <FieldBlock>
                  <Label htmlFor={`checkin-scheduled-${checkin.id}`}>
                    Scheduled date
                  </Label>
                  <Input
                    id={`checkin-scheduled-${checkin.id}`}
                    type="date"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                  />
                </FieldBlock>
                <FieldBlock>
                  <Label htmlFor={`checkin-summary-${checkin.id}`}>Notes</Label>
                  <Textarea
                    id={`checkin-summary-${checkin.id}`}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    maxLength={500}
                  />
                </FieldBlock>
                <DialogFooter>
                  <SubmitButton pending={pending}>Save changes</SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <DeleteButton
            label="Check-in deleted"
            description="This removes the check-in and its answers."
            onDelete={() => deleteCheckinAction({ id: checkin.id })}
          />
        </>
      )}
    </div>
  );
}

export function DocumentRowActions({
  document,
  canManage,
}: {
  document: DocumentActionRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(document.name);
  const [category, setCategory] = useState<DocumentCategory>(document.category);
  const [visibility, setVisibility] = useState<Visibility>(document.visibility);
  const [expiresOn, setExpiresOn] = useState(document.expires_on ?? "");
  const [reminderOn, setReminderOn] = useState(document.reminder_on ?? "");
  const [notes, setNotes] = useState(document.notes ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateDocumentAction({
      id: document.id,
      name,
      category,
      visibility,
      expiresOn,
      reminderOn,
      notes,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Document updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <RowActionButton>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </RowActionButton>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit document</DialogTitle>
                <DialogDescription>Update document details.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`document-name-${document.id}`}>Name</Label>
                    <Input
                      id={`document-name-${document.id}`}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={100}
                      required
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`document-category-${document.id}`}>
                      Category
                    </Label>
                    <Select
                      value={category}
                      onValueChange={(value) =>
                        setCategory(value as DocumentCategory)
                      }
                    >
                      <SelectTrigger
                        id={`document-category-${document.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {DOCUMENT_CATEGORY_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`document-reminder-${document.id}`}>
                      Reminder
                    </Label>
                    <Input
                      id={`document-reminder-${document.id}`}
                      type="date"
                      value={reminderOn}
                      onChange={(event) => setReminderOn(event.target.value)}
                    />
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`document-expires-${document.id}`}>
                      Expires
                    </Label>
                    <Input
                      id={`document-expires-${document.id}`}
                      type="date"
                      value={expiresOn}
                      onChange={(event) => setExpiresOn(event.target.value)}
                    />
                  </FieldBlock>
                </div>
                <FieldBlock>
                  <Label>Visibility</Label>
                  <VisibilitySelect value={visibility} onChange={setVisibility} />
                </FieldBlock>
                <FieldBlock>
                  <Label htmlFor={`document-notes-${document.id}`}>Notes</Label>
                  <Textarea
                    id={`document-notes-${document.id}`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={500}
                  />
                </FieldBlock>
                <DialogFooter>
                  <SubmitButton pending={pending}>Save changes</SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <DeleteButton
            label="Document deleted"
            description="This removes the document from the vault."
            onDelete={() => deleteDocumentAction({ id: document.id })}
          />
        </>
      )}
    </div>
  );
}

export function TaskRowActions({
  task,
  members,
  canManage,
}: {
  task: TaskActionRow;
  members: MemberOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "unassigned");
  const [dueOn, setDueOn] = useState(task.due_on ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updateTaskAction({
      id: task.id,
      title,
      description,
      assignedTo: assignedTo === "unassigned" ? null : assignedTo,
      dueOn,
      priority,
      status,
    });
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Task updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {!canManage ? (
        <span className="px-2 text-xs text-muted-foreground">View only</span>
      ) : (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <RowActionButton>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </RowActionButton>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
                <DialogDescription>Update this follow-up.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <FieldBlock>
                  <Label htmlFor={`task-title-${task.id}`}>Task</Label>
                  <Input
                    id={`task-title-${task.id}`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={100}
                    required
                  />
                </FieldBlock>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`task-assignee-${task.id}`}>Assigned to</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger
                        id={`task-assignee-${task.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`task-status-${task.id}`}>Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as TaskStatus)}
                    >
                      <SelectTrigger
                        id={`task-status-${task.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {titleCase(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock>
                    <Label htmlFor={`task-priority-${task.id}`}>Priority</Label>
                    <Select
                      value={priority}
                      onValueChange={(value) => setPriority(value as TaskPriority)}
                    >
                      <SelectTrigger
                        id={`task-priority-${task.id}`}
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {titleCase(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldBlock>
                  <FieldBlock>
                    <Label htmlFor={`task-due-${task.id}`}>Due date</Label>
                    <Input
                      id={`task-due-${task.id}`}
                      type="date"
                      value={dueOn}
                      onChange={(event) => setDueOn(event.target.value)}
                    />
                  </FieldBlock>
                </div>
                <FieldBlock>
                  <Label htmlFor={`task-description-${task.id}`}>Description</Label>
                  <Textarea
                    id={`task-description-${task.id}`}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                  />
                </FieldBlock>
                <DialogFooter>
                  <SubmitButton pending={pending}>Save changes</SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <DeleteButton
            label="Task deleted"
            description="This removes the task from the workspace."
            onDelete={() => deleteTaskAction({ id: task.id })}
          />
        </>
      )}
    </div>
  );
}

export function SectionActions({
  section,
  today,
  currentMonth,
  currency,
  workspaceId,
  userId,
  members,
  readOnly = false,
}: SectionActionsProps) {
  if (readOnly) return null;
  if (section === "expenses") {
    return <ExpenseDialog today={today} currency={currency} />;
  }
  if (section === "budgets") {
    return <BudgetDialog currentMonth={currentMonth} currency={currency} />;
  }
  if (section === "debts") return <DebtDialog currency={currency} />;
  if (section === "goals") {
    return <GoalDialog coupleOnly={false} currency={currency} />;
  }
  if (section === "couple-goals") {
    return <GoalDialog coupleOnly currency={currency} />;
  }
  if (section === "emergency-fund") {
    return <EmergencyFundDialog currency={currency} />;
  }
  if (section === "investments") {
    return <InvestmentDialog currency={currency} />;
  }
  if (section === "research") {
    return <ResearchDialog currency={currency} />;
  }
  if (section === "check-ins") {
    return <CheckinDialog currentMonth={currentMonth} />;
  }
  if (section === "documents") {
    return <DocumentDialog workspaceId={workspaceId} userId={userId} />;
  }
  if (section === "tasks") {
    return <TaskDialog members={members} />;
  }
  return null;
}
