import type { Filing, DerivedMetrics } from "@/types";

// ---------------------------------------------------------------------------
// Safe arithmetic helpers
// ---------------------------------------------------------------------------

function safeDiv(numerator: number | null | undefined, denominator: number | null | undefined): number | undefined {
  if (numerator == null || denominator == null || denominator === 0) return undefined;
  return numerator / denominator;
}

function safeGrowth(current: number | null | undefined, prior: number | null | undefined): number | undefined {
  if (current == null || prior == null || prior === 0) return undefined;
  // Guard against sign-change artifacts: if prior is negative use absolute value
  return (current - prior) / Math.abs(prior);
}

// ---------------------------------------------------------------------------
// Per-filing metric computation
// ---------------------------------------------------------------------------

export function computeMetrics(
  ein: string,
  organizationId: string,
  filing: Filing,
  priorFiling?: Filing
): DerivedMetrics {
  const programExpenseRatio = safeDiv(filing.programExpenses, filing.totalExpenses);
  const adminRatio = safeDiv(filing.adminExpenses, filing.totalExpenses);
  const fundraisingRatio = safeDiv(filing.fundraisingExpenses, filing.totalExpenses);
  const netMargin = safeDiv(filing.netIncome, filing.totalRevenue);
  // Months of reserves: netAssets / (totalExpenses / 12)
  const monthlyExpenses = filing.totalExpenses != null ? filing.totalExpenses / 12 : undefined;
  const liquidityRatio = safeDiv(filing.netAssets, monthlyExpenses);

  const revenueGrowthYoY = priorFiling
    ? safeGrowth(filing.totalRevenue, priorFiling.totalRevenue)
    : undefined;
  const assetGrowthYoY = priorFiling
    ? safeGrowth(filing.totalAssets, priorFiling.totalAssets)
    : undefined;

  return {
    id: `dm_${ein}_${filing.taxYear}`,
    organizationId,
    ein,
    taxYear: filing.taxYear,
    programExpenseRatio,
    adminRatio,
    fundraisingRatio,
    revenueGrowthYoY,
    assetGrowthYoY,
    netMargin,
    liquidityRatio,
  };
}

// ---------------------------------------------------------------------------
// Batch computation across all filings (sorted ascending by year)
// ---------------------------------------------------------------------------

export function computeAllMetrics(
  ein: string,
  organizationId: string,
  filings: Filing[]
): DerivedMetrics[] {
  const sorted = [...filings].sort((a, b) => a.taxYear - b.taxYear);
  return sorted.map((filing, i) =>
    computeMetrics(ein, organizationId, filing, i > 0 ? sorted[i - 1] : undefined)
  );
}

// ---------------------------------------------------------------------------
// Metric metadata (labels + tooltips) for UI rendering
// ---------------------------------------------------------------------------

export interface MetricMeta {
  key: keyof DerivedMetrics;
  label: string;
  tooltip: string;
  format: "percent" | "ratio" | "currency" | "number";
  /** Higher is better? null = neutral */
  higherIsBetter: boolean | null;
}

export const METRIC_META: MetricMeta[] = [
  {
    key: "programExpenseRatio",
    label: "Program Expense Ratio",
    tooltip:
      "Percentage of total expenses directed to mission programs. Higher is generally better; watchdog groups often look for ≥ 75%.",
    format: "percent",
    higherIsBetter: true,
  },
  {
    key: "adminRatio",
    label: "Admin Ratio",
    tooltip:
      "Percentage of expenses for management & general overhead. Lower indicates leaner administration.",
    format: "percent",
    higherIsBetter: false,
  },
  {
    key: "fundraisingRatio",
    label: "Fundraising Ratio",
    tooltip:
      "Percentage of expenses spent on fundraising. Context matters — organizations with large donor bases spend more here.",
    format: "percent",
    higherIsBetter: null,
  },
  {
    key: "revenueGrowthYoY",
    label: "Revenue Growth (YoY)",
    tooltip:
      "Year-over-year change in total revenue. Positive growth indicates organizational expansion.",
    format: "percent",
    higherIsBetter: true,
  },
  {
    key: "assetGrowthYoY",
    label: "Asset Growth (YoY)",
    tooltip:
      "Year-over-year change in total assets. Reflects the organization's balance-sheet trajectory.",
    format: "percent",
    higherIsBetter: null,
  },
  {
    key: "netMargin",
    label: "Net Margin",
    tooltip:
      "Net income as a percentage of total revenue. Nonprofits aim for a small positive margin (1–5%) to maintain reserves.",
    format: "percent",
    higherIsBetter: null,
  },
  {
    key: "liquidityRatio",
    label: "Months of Reserves",
    tooltip:
      "Net assets divided by average monthly expenses. Represents how many months the organization could operate without new revenue. ≥ 3 months is a common benchmark.",
    format: "ratio",
    higherIsBetter: true,
  },
];
