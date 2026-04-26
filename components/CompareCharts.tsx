"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationWithFilings } from "@/types";

interface CompareChartsProps {
  orgs: OrganizationWithFilings[];
}

const PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#7c3aed", "#0891b2",
];

function shortNum(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

function makeBars(
  orgs: OrganizationWithFilings[],
  key: keyof OrganizationWithFilings["filings"][0],
  years = [2021, 2022, 2023]
) {
  return years.map((year) => {
    const row: Record<string, number | string> = { year };
    for (const org of orgs) {
      const f = org.filings.find((fi) => fi.taxYear === year);
      row[org.name] = (f?.[key] as number) ?? 0;
    }
    return row;
  });
}

export function CompareCharts({ orgs }: CompareChartsProps) {
  const revenueData = makeBars(orgs, "totalRevenue");
  const expensesData = makeBars(orgs, "totalExpenses");
  const assetsData = makeBars(orgs, "totalAssets");

  // Ratio radar data (latest year)
  const radarData = [
    {
      metric: "Program %",
      ...Object.fromEntries(
        orgs.map((o) => [
          o.name,
          o.latestMetrics?.programExpenseRatio != null
            ? +(o.latestMetrics.programExpenseRatio * 100).toFixed(1)
            : 0,
        ])
      ),
    },
    {
      metric: "Admin %",
      ...Object.fromEntries(
        orgs.map((o) => [
          o.name,
          o.latestMetrics?.adminRatio != null
            ? +(o.latestMetrics.adminRatio * 100).toFixed(1)
            : 0,
        ])
      ),
    },
    {
      metric: "Fundraising %",
      ...Object.fromEntries(
        orgs.map((o) => [
          o.name,
          o.latestMetrics?.fundraisingRatio != null
            ? +(o.latestMetrics.fundraisingRatio * 100).toFixed(1)
            : 0,
        ])
      ),
    },
  ];

  const bars = orgs.map((org, i) => (
    <Bar key={org.ein} dataKey={org.name} fill={PALETTE[i % PALETTE.length]} />
  ));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={shortNum} tick={{ fontSize: 10 }} width={65} />
              <Tooltip formatter={(v: number) => shortNum(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {bars}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Expenses Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={expensesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={shortNum} tick={{ fontSize: 10 }} width={65} />
              <Tooltip formatter={(v: number) => shortNum(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {bars}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assets Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={assetsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={shortNum} tick={{ fontSize: 10 }} width={65} />
              <Tooltip formatter={(v: number) => shortNum(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {bars}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Expense Ratio Comparison (Latest Year)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
              {orgs.map((org, i) => (
                <Radar
                  key={org.ein}
                  name={org.name}
                  dataKey={org.name}
                  stroke={PALETTE[i % PALETTE.length]}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
