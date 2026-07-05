"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Banknote } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MoneyInput } from "@/components/shared/money-input";
import { INCOME_FREQUENCIES, INCOME_TYPES, type Visibility } from "@/lib/constants";
import { saveIncomeStepAction } from "../actions";
import {
  FIXED_EXPENSE_PRESETS,
  INCOME_FREQUENCY_LABELS,
  INCOME_TYPE_LABELS,
} from "./wizard-constants";
import {
  incomeStepFormSchema,
  parseMoney,
  type IncomeStepFormValues,
} from "./wizard-schemas";
import { WizardFooter } from "./wizard-footer";
import {
  AddRowButton,
  RowCard,
  SoftNote,
  StepCard,
  VisibilityInlineSelect,
} from "./wizard-ui";

const EMPTY_INCOME: IncomeStepFormValues["incomes"][number] = {
  name: "",
  incomeType: "salary",
  amount: "",
  frequency: "monthly",
  visibility: "shared",
};

type BillState = { checked: boolean; amount: string };

export function StepIncome({
  currency,
  onBack,
  onDone,
}: {
  currency: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [bills, setBills] = useState<Record<string, BillState>>(() =>
    Object.fromEntries(
      FIXED_EXPENSE_PRESETS.map((p) => [p.key, { checked: false, amount: "" }])
    )
  );
  const [billsVisibility, setBillsVisibility] = useState<Visibility>("shared");
  const [billError, setBillError] = useState<string | null>(null);

  const form = useForm<IncomeStepFormValues>({
    resolver: zodResolver(incomeStepFormSchema),
    defaultValues: { incomes: [{ ...EMPTY_INCOME }] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "incomes",
  });

  function setBill(key: string, patch: Partial<BillState>) {
    setBills((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { checked: false, amount: "" }), ...patch },
    }));
  }

  async function onSubmit(values: IncomeStepFormValues) {
    const selectedBills: {
      label: string;
      category: (typeof FIXED_EXPENSE_PRESETS)[number]["category"];
      amount: number;
    }[] = [];
    for (const preset of FIXED_EXPENSE_PRESETS) {
      const bill = bills[preset.key];
      if (!bill?.checked) continue;
      const amount = parseMoney(bill.amount);
      if (amount <= 0) {
        setBillError(
          "Add an amount for each bill you've ticked — or untick it for now."
        );
        return;
      }
      selectedBills.push({
        label: preset.label,
        category: preset.category,
        amount,
      });
    }
    setBillError(null);

    setSubmitting(true);
    const result = await saveIncomeStepAction({
      incomes: values.incomes.map((income) => ({
        name: income.name,
        incomeType: income.incomeType,
        amount: parseMoney(income.amount),
        frequency: income.frequency,
        visibility: income.visibility,
      })),
      bills: selectedBills,
      billsVisibility,
    });
    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    onDone();
  }

  const { errors } = form.formState;

  return (
    <StepCard
      icon={Banknote}
      title="Your income & regular bills"
      description="Add what you&apos;re comfortable with — estimates are fine, and every item gets its own visibility."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          {/* ------------------------------------------------ income rows */}
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">Income</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Salary, freelance, side projects — whatever comes in.
              </p>
            </div>

            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No income added — that&apos;s okay, you can do this later.
              </p>
            )}

            {fields.map((field, index) => {
              const rowErrors = errors.incomes?.[index];
              return (
                <RowCard
                  key={field.id}
                  title={`Income ${index + 1}`}
                  onRemove={() => remove(index)}
                  removeLabel={`Remove income ${index + 1}`}
                >
                  <Field data-invalid={!!rowErrors?.name || undefined}>
                    <FieldLabel htmlFor={`income-name-${index}`}>
                      Name
                    </FieldLabel>
                    <Input
                      id={`income-name-${index}`}
                      placeholder="e.g. Salary"
                      className="h-11"
                      aria-invalid={!!rowErrors?.name}
                      {...form.register(`incomes.${index}.name`)}
                    />
                    <FieldError errors={[rowErrors?.name]} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`income-type-${index}`}>
                        Type
                      </FieldLabel>
                      <Controller
                        control={form.control}
                        name={`incomes.${index}.incomeType`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger
                              id={`income-type-${index}`}
                              className="h-11 w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INCOME_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {INCOME_TYPE_LABELS[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`income-frequency-${index}`}>
                        How often
                      </FieldLabel>
                      <Controller
                        control={form.control}
                        name={`incomes.${index}.frequency`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger
                              id={`income-frequency-${index}`}
                              className="h-11 w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INCOME_FREQUENCIES.map((frequency) => (
                                <SelectItem key={frequency} value={frequency}>
                                  {INCOME_FREQUENCY_LABELS[frequency]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={!!rowErrors?.amount || undefined}>
                      <FieldLabel htmlFor={`income-amount-${index}`}>
                        Amount
                      </FieldLabel>
                      <Controller
                        control={form.control}
                        name={`incomes.${index}.amount`}
                        render={({ field: f }) => (
                          <MoneyInput
                            id={`income-amount-${index}`}
                            value={f.value}
                            onChange={f.onChange}
                            currency={currency}
                          />
                        )}
                      />
                      <FieldError errors={[rowErrors?.amount]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`income-visibility-${index}`}>
                        Who can see it
                      </FieldLabel>
                      <Controller
                        control={form.control}
                        name={`incomes.${index}.visibility`}
                        render={({ field: f }) => (
                          <VisibilityInlineSelect
                            id={`income-visibility-${index}`}
                            value={f.value}
                            onChange={f.onChange}
                          />
                        )}
                      />
                    </Field>
                  </div>
                </RowCard>
              );
            })}

            {fields.length < 10 && (
              <AddRowButton onClick={() => append({ ...EMPTY_INCOME })}>
                Add another income
              </AddRowButton>
            )}
          </div>

          <Separator />

          {/* ------------------------------------------------ fixed bills */}
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">Monthly bills</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Tick what applies and pop in a rough monthly number.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {FIXED_EXPENSE_PRESETS.map((preset) => {
                const bill = bills[preset.key] ?? {
                  checked: false,
                  amount: "",
                };
                return (
                  <div
                    key={preset.key}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
                  >
                    <Checkbox
                      id={`bill-${preset.key}`}
                      checked={bill.checked}
                      onCheckedChange={(checked) =>
                        setBill(preset.key, { checked: checked === true })
                      }
                    />
                    <Label
                      htmlFor={`bill-${preset.key}`}
                      className="flex min-h-11 flex-1 cursor-pointer items-center text-sm font-normal"
                    >
                      {preset.label}
                    </Label>
                    <div className="w-28 sm:w-36">
                      <MoneyInput
                        id={`bill-amount-${preset.key}`}
                        value={bill.amount}
                        onChange={(v) => setBill(preset.key, { amount: v })}
                        disabled={!bill.checked}
                        currency={currency}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {billError && (
              <p role="alert" className="text-sm text-destructive">
                {billError}
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="bills-visibility">
                Who can see these bills?
              </FieldLabel>
              <VisibilityInlineSelect
                id="bills-visibility"
                value={billsVisibility}
                onChange={setBillsVisibility}
              />
              <FieldDescription>
                They&apos;re saved as monthly recurring expenses paid by you — easy
                to fine-tune later.
              </FieldDescription>
            </Field>
          </div>

          <SoftNote>
            Numbers can be rough — this just gives your cash flow view a
            starting point.
          </SoftNote>

          <WizardFooter
            onBack={onBack}
            submitting={submitting}
            skipStep={5}
            onSkipped={onDone}
          />
        </div>
      </form>
    </StepCard>
  );
}
