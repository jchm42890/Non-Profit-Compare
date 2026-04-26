import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricTooltip } from "@/components/MetricTooltip";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils/format";
import type { Filing, DerivedMetrics } from "@/types";

interface KPIGridProps {
  filing: Filing;
  metrics?: DerivedMetrics;
}

interface KPICard {
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
  trend?: "up" | "down" | "neutral";
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "neutral" }) {
  if (!trend || trend === "neutral") return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}

export function KPIGrid({ filing, metrics }: KPIGridProps) {
  const cards: KPICard[] = [
    {
      label: "Total Revenue",
      value: formatCurrency(filing.totalRevenue, { compact: true }),
      sub: `Tax Year ${filing.taxYear}`,
      tooltip: "Total revenue reported on Form 990.",
      trend: metrics?.revenueGrowthYoY != null
        ? metrics.revenueGrowthYoY > 0 ? "up" : metrics.revenueGrowthYoY < 0 ? "down" : "neutral"
        : undefined,
    },
    {
      label: "Total Expenses",
      value: formatCurrency(filing.totalExpenses, { compact: true }),
      sub: filing.totalRevenue && filing.totalExpenses
        ? `${((filing.totalExpenses / filing.totalRevenue) * 100).toFixed(0)}% of revenue`
        : undefined,
      tooltip: "Total expenses reported on Form 990, including program, admin, and fundraising.",
    },
    {
      label: "Total Assets",
      value: formatCurrency(filing.totalAssets, { compact: true }),
      sub: filing.totalLiabilities
        ? `Liabilities: ${formatCurrency(filing.totalLiabilities, { compact: true })}`
        : undefined,
      tooltip: "Total assets on the balance sheet at year end.",
      trend: metrics?.assetGrowthYoY != null
        ? metrics.assetGrowthYoY > 0 ? "up" : metrics.assetGrowthYoY < 0 ? "down" : "neutral"
        : undefined,
    },
    {
      label: "Net Assets",
      value: formatCurrency(filing.netAssets, { compact: true }),
      tooltip: "Total assets minus total liabilities — the organization's net worth.",
    },
    {
      label: "Contributions & Grants",
      value: formatCurrency(filing.totalContributions, { compact: true }),
      sub: filing.totalRevenue && filing.totalContributions
        ? `${((filing.totalContributions / filing.totalRevenue) * 100).toFixed(0)}% of revenue`
        : undefined,
      tooltip: "Total donations, grants, and contributions received.",
    },
    {
      label: "Program Service Rev.",
      value: formatCurrency(filing.programServiceRevenue, { compact: true }),
      tooltip: "Revenue earned directly from carrying out the organization's mission (fees, contracts, etc.).",
    },
    {
      label: "Program Exp. Ratio",
      value: formatPercent(metrics?.programExpenseRatio),
      tooltip: "Percentage of total expenses used for mission programs. Watchdog groups look for ≥ 75%.",
      trend: metrics?.programExpenseRatio != null
        ? metrics.programExpenseRatio >= 0.75 ? "up" : "down"
        : undefined,
    },
    {
      label: "Executive Compensation",
      value: formatCurrency(filing.executiveCompensation, { compact: true }),
      tooltip: "Total compensation paid to officers, directors, and key employees as reported on Form 990.",
    },
    {
      label: "Employee Count",
      value: filing.employeeCount != null ? formatNumber(filing.employeeCount) : "N/A",
      tooltip: "Approximate number of employees including full-time and part-time.",
    },
    {
      label: "Months of Reserves",
      value: metrics?.liquidityRatio != null
        ? `${metrics.liquidityRatio.toFixed(1)} mo`
        : "N/A",
      tooltip: "Net assets divided by average monthly expenses. How long the org could run without new revenue.",
      trend: metrics?.liquidityRatio != null
        ? metrics.liquidityRatio >= 3 ? "up" : "down"
        : undefined,
    },
    {
      label: "Net Margin",
      value: formatPercent(metrics?.netMargin),
      tooltip: "Net income as a percentage of total revenue. Nonprofits target a small positive margin.",
      trend: metrics?.netMargin != null
        ? metrics.netMargin > 0 ? "up" : metrics.netMargin < -0.05 ? "down" : "neutral"
        : undefined,
    },
    {
      label: "Revenue Growth (YoY)",
      value: metrics?.revenueGrowthYoY != null
        ? `${metrics.revenueGrowthYoY > 0 ? "+" : ""}${(metrics.revenueGrowthYoY * 100).toFixed(1)}%`
        : "N/A",
      tooltip: "Year-over-year change in total revenue.",
      trend: metrics?.revenueGrowthYoY != null
        ? metrics.revenueGrowthYoY > 0 ? "up" : metrics.revenueGrowthYoY < 0 ? "down" : "neutral"
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground leading-tight">
                {card.label}
                {card.tooltip && <MetricTooltip content={card.tooltip} />}
              </p>
              <TrendIcon trend={card.trend} />
            </div>
            <p className="mt-1.5 text-xl font-bold leading-none">{card.value}</p>
            {card.sub && <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
