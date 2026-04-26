"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import type { Filing, DerivedMetrics } from "@/types";

interface TrendChartProps {
  filings: Filing[];
  metrics?: DerivedMetrics[];
  type?: "financial" | "ratios";
}

const COLORS = {
  revenue: "#2563eb",
  expenses: "#dc2626",
  assets: "#16a34a",
  programRatio: "#7c3aed",
  adminRatio: "#ea580c",
  fundraisingRatio: "#0891b2",
};

function shortCurrency(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function TrendChart({ filings, metrics = [], type = "financial" }: TrendChartProps) {
  const sorted = [...filings].sort((a, b) => a.taxYear - b.taxYear);

  if (type === "financial") {
    const data = sorted.map((f) => ({
      year: f.taxYear,
      Revenue: f.totalRevenue,
      Expenses: f.totalExpenses,
      Assets: f.totalAssets,
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(value: number, name: string) => [shortCurrency(value), name]}
            labelFormatter={(l) => `Year: ${l}`}
          />
          <Legend />
          <Line type="monotone" dataKey="Revenue" stroke={COLORS.revenue} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Expenses" stroke={COLORS.expenses} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Assets" stroke={COLORS.assets} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Ratios chart
  const sortedMetrics = [...metrics].sort((a, b) => a.taxYear - b.taxYear);
  const data = sortedMetrics.map((m) => ({
    year: m.taxYear,
    "Program": m.programExpenseRatio != null ? +(m.programExpenseRatio * 100).toFixed(1) : null,
    "Admin": m.adminRatio != null ? +(m.adminRatio * 100).toFixed(1) : null,
    "Fundraising": m.fundraisingRatio != null ? +(m.fundraisingRatio * 100).toFixed(1) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
        <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(l) => `Year: ${l}`} />
        <Legend />
        <Bar dataKey="Program" stackId="a" fill={COLORS.programRatio} />
        <Bar dataKey="Admin" stackId="a" fill={COLORS.adminRatio} />
        <Bar dataKey="Fundraising" stackId="a" fill={COLORS.fundraisingRatio} />
      </BarChart>
    </ResponsiveContainer>
  );
}
