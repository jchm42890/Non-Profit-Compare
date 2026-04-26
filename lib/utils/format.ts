// Currency, number, and percentage formatting helpers

export function formatCurrency(
  value: number | null | undefined,
  options: { compact?: boolean; decimals?: number } = {}
): string {
  if (value == null) return "N/A";
  const { compact = false, decimals = 0 } = options;

  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000)
      return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(decimals)}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatGrowth(value: number | null | undefined): string {
  if (value == null) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatEin(ein: string): string {
  const cleaned = ein.replace(/\D/g, "");
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  }
  return ein;
}

export function formatState(state: string): string {
  return state.toUpperCase();
}
