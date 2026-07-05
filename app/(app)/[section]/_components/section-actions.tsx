"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

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
} from "../actions";

type SectionActionsProps = {
  section: string;
  today: string;
  currentMonth: string;
};

type ActionResult = { error: string } | { success: true };

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
