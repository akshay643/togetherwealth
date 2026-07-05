"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  DEBT_TYPE_LABELS,
  DEBT_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPES,
  GOAL_TYPE_LABELS,
  GOAL_TYPES,
  RECURRENCE_FREQUENCIES,
  type DebtType,
  type ExpenseCategory,
  type ExpenseType,
  type GoalType,
  type RecurrenceFrequency,
  type Visibility,
} from "@/lib/constants";
import {
  createBudgetAction,
  createDebtAction,
  createExpenseAction,
  createGoalAction,
  deleteBudgetAction,
  deleteDebtAction,
  deleteExpenseAction,
  deleteGoalAction,
  updateBudgetAction,
  updateDebtAction,
  updateExpenseAction,
  updateGoalAction,
} from "../actions";

type SectionActionsProps = {
  section: string;
  today: string;
  currentMonth: string;
};

type ActionResult = { error: string } | { success: true };

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

const VISIBILITY_DEFAULT: Visibility = "shared";

function amountOf(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
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

function ExpenseDialog({ today }: { today: string }) {
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

function BudgetDialog({ currentMonth }: { currentMonth: string }) {
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

function DebtDialog() {
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
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="debt-minimum">Monthly minimum</Label>
              <MoneyInput
                id="debt-minimum"
                value={minimumPayment}
                onChange={setMinimumPayment}
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

function GoalDialog({ coupleOnly }: { coupleOnly: boolean }) {
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
              />
            </FieldBlock>
            <FieldBlock>
              <Label htmlFor="goal-monthly">Monthly contribution</Label>
              <MoneyInput
                id="goal-monthly"
                value={monthlyContribution}
                onChange={setMonthlyContribution}
                placeholder="Optional"
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
  description,
  onDelete,
}: Readonly<{
  label: string;
  description: string;
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
          Delete
        </Button>
      }
      title="Delete this item?"
      description={description}
      confirmLabel="Delete"
      destructive
      onConfirm={handleDelete}
    />
  );
}

export function ExpenseRowActions({ expense }: { expense: ExpenseActionRow }) {
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
    </div>
  );
}

export function BudgetRowActions({ budget }: { budget: BudgetActionRow }) {
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
    </div>
  );
}

export function DebtRowActions({ debt }: { debt: DebtActionRow }) {
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
    </div>
  );
}

export function GoalRowActions({
  goal,
  coupleOnly = false,
}: {
  goal: GoalActionRow;
  coupleOnly?: boolean;
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
    </div>
  );
}

export function SectionActions({
  section,
  today,
  currentMonth,
}: SectionActionsProps) {
  if (section === "expenses") return <ExpenseDialog today={today} />;
  if (section === "budgets") {
    return <BudgetDialog currentMonth={currentMonth} />;
  }
  if (section === "debts") return <DebtDialog />;
  if (section === "goals") return <GoalDialog coupleOnly={false} />;
  if (section === "couple-goals") return <GoalDialog coupleOnly />;
  return null;
}
