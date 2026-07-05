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
  currency?: string;
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

function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  })
    .formatToParts(0)
    .find((item) => item.type === "currency");
  return part?.value ?? currency.toUpperCase();
}

/**
 * Currency amount input. Controlled string value (keep amounts as strings in
 * form state; parse with Number() when submitting).
 */
export function MoneyInput({
  value,
  onChange,
  currency = "USD",
  placeholder = "0.00",
  disabled,
  id,
}: MoneyInputProps) {
  const normalizedCurrency = currency.toUpperCase();

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <InputGroupText aria-hidden>
          {currencySymbol(normalizedCurrency)}
        </InputGroupText>
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
        aria-label={`Amount in ${normalizedCurrency}`}
      />
    </InputGroup>
  );
}
