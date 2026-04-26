"use client";

import { MetricTooltip } from "@/components/MetricTooltip";
import { formatCurrency, formatPercent, formatNumber, formatGrowth, formatEin } from "@/lib/utils/format";
import type { OrganizationWithFilings } from "@/types";
import { cn } from "@/lib/utils/cn";

interface CompareTableProps {
  orgs: OrganizationWithFilings[];
}

interface RowDef {
  label: string;
  tooltip?: string;
  getValue: (org: OrganizationWithFilings) => string;
  isHighlight?: boolean;
}

const ROWS: RowDef[] = [
  { label: "Name",         getValue: (o) => o.name, isHighlight: true },
  { label: "EIN",          getValue: (o) => formatEin(o.ein) },
  { label: "Location",     getValue: (o) => `${o.city}, ${o.state}` },
  { label: "Category",     getValue: (o) => o.nteeCategory },
  { label: "NTEE Code",    getValue: (o) => o.nteeCode },
  { label: "Filing Year",  getValue: (o) => o.latestFiling?.taxYear?.toString() ?? "N/A" },
  {
    label: "Total Revenue",
    tooltip: "Total revenue reported on Form 990.",
    getValue: (o) => formatCurrency(o.latestFiling?.totalRevenue, { compact: true }),
    isHighlight: true,
  },
  {
    label: "Total Expenses",
    tooltip: "Total expenses (program + admin + fundraising).",
    getValue: (o) => formatCurrency(o.latestFiling?.totalExpenses, { compact: true }),
    isHighlight: true,
  },
  {
    label: "Total Assets",
    tooltip: "Total assets on the balance sheet at year end.",
    getValue: (o) => formatCurrency(o.latestFiling?.totalAssets, { compact: true }),
    isHighlight: true,
  },
  {
    label: "Total Liabilities",
    getValue: (o) => formatCurrency(o.latestFiling?.totalLiabilities, { compact: true }),
  },
  {
    label: "Net Assets",
    tooltip: "Assets minus liabilities — the organization's equity.",
    getValue: (o) => formatCurrency(o.latestFiling?.netAssets, { compact: true }),
  },
  {
    label: "Contributions & Grants",
    tooltip: "Total donations and grants received.",
    getValue: (o) => formatCurrency(o.latestFiling?.totalContributions, { compact: true }),
  },
  {
    label: "Program Service Revenue",
    tooltip: "Revenue earned from mission-related activities.",
    getValue: (o) => formatCurrency(o.latestFiling?.programServiceRevenue, { compact: true }),
  },
  {
    label: "Executive Compensation",
    tooltip: "Total compensation to officers and key employees.",
    getValue: (o) => formatCurrency(o.latestFiling?.executiveCompensation, { compact: true }),
  },
  {
    label: "Program Expense Ratio",
    tooltip: "% of expenses directed to mission programs. Higher is generally better (≥ 75%).",
    getValue: (o) => formatPercent(o.latestMetrics?.programExpenseRatio),
    isHighlight: true,
  },
  {
    label: "Admin Ratio",
    tooltip: "% of expenses for management & general overhead.",
    getValue: (o) => formatPercent(o.latestMetrics?.adminRatio),
    isHighlight: true,
  },
  {
    label: "Fundraising Ratio",
    tooltip: "% of expenses spent on fundraising activities.",
    getValue: (o) => formatPercent(o.latestMetrics?.fundraisingRatio),
    isHighlight: true,
  },
  {
    label: "Revenue Growth (YoY)",
    tooltip: "Year-over-year change in total revenue.",
    getValue: (o) => formatGrowth(o.latestMetrics?.revenueGrowthYoY),
    isHighlight: true,
  },
  {
    label: "Asset Growth (YoY)",
    tooltip: "Year-over-year change in total assets.",
    getValue: (o) => formatGrowth(o.latestMetrics?.assetGrowthYoY),
  },
  {
    label: "Net Margin",
    tooltip: "Net income as % of total revenue.",
    getValue: (o) => formatPercent(o.latestMetrics?.netMargin),
  },
  {
    label: "Months of Reserves",
    tooltip: "Net assets ÷ monthly expenses. How long the org could operate without new revenue.",
    getValue: (o) =>
      o.latestMetrics?.liquidityRatio != null
        ? `${o.latestMetrics.liquidityRatio.toFixed(1)} mo`
        : "N/A",
  },
  {
    label: "Employee Count",
    getValue: (o) =>
      o.latestFiling?.employeeCount != null
        ? formatNumber(o.latestFiling.employeeCount)
        : "N/A",
  },
];

export function CompareTable({ orgs }: CompareTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[160px]">
              Metric
            </th>
            {orgs.map((org) => (
              <th key={org.ein} className="px-4 py-3 text-left font-semibold min-w-[160px]">
                <div className="line-clamp-2 text-sm leading-snug">{org.name}</div>
                <div className="text-xs font-normal text-muted-foreground mt-0.5">{org.city}, {org.state}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => (
            <tr
              key={row.label}
              className={cn(
                "border-b last:border-0",
                row.isHighlight ? "bg-muted/20" : "",
                i % 2 === 0 ? "" : "bg-muted/5"
              )}
            >
              <td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium text-muted-foreground text-xs">
                {row.label}
                {row.tooltip && <MetricTooltip content={row.tooltip} />}
              </td>
              {orgs.map((org) => (
                <td key={org.ein} className="px-4 py-3 tabular-nums font-medium">
                  {row.getValue(org)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
