/** Shared formatting helpers. Keep display formatting consistent app-wide. */

export function formatCurrency(
  amount: number | null | undefined,
  opts: { currency?: string; compact?: boolean; showSign?: boolean } = {}
): string {
  const { currency = "USD", compact = false, showSign = false } = opts;
  const value = amount ?? 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(value);
  return showSign && value > 0 ? `+${formatted}` : formatted;
}

export function formatPercent(
  value: number | null | undefined,
  opts: { decimals?: number } = {}
): string {
  const { decimals = 0 } = opts;
  return `${((value ?? 0) * 100).toFixed(decimals)}%`;
}

export function formatDate(
  date: string | Date | null | undefined,
  opts: { style?: "short" | "medium" | "long" } = {}
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const { style = "medium" } = opts;
  return new Intl.DateTimeFormat("en-US", {
    month: style === "short" ? "numeric" : style === "long" ? "long" : "short",
    day: "numeric",
    year: style === "short" ? "2-digit" : "numeric",
  }).format(d);
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** First day of a month as a `yyyy-MM-dd` string (used for budget periods). */
export function monthStart(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
