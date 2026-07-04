"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

export interface MoneyInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/** Keep digits and a single decimal point, max two decimal places. */
function sanitizeMoney(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...decimals] = cleaned.split(".");
  if (decimals.length === 0) return whole;
  return `${whole}.${decimals.join("").slice(0, 2)}`;
}

/**
 * Dollar amount input. Controlled string value (keep amounts as strings in
 * form state; parse with Number() when submitting).
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0.00",
  disabled,
  id,
}: MoneyInputProps) {
  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <InputGroupText aria-hidden>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(sanitizeMoney(e.target.value))}
        className="tabular-nums"
        aria-label="Amount in dollars"
      />
    </InputGroup>
  );
}
