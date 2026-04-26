"use client";

import { useEffect, useState } from "react";
import type { ScheduleJResult } from "@/lib/irs/fetch-schedule-j";
import { formatCurrency } from "@/lib/utils/format";

interface Props {
  ein: string;
}

interface CompensationResponse {
  ein: string;
  years: ScheduleJResult[];
  error?: string;
}

export function CompensationTable({ ein }: Props) {
  const [data, setData] = useState<CompensationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/nonprofit/${ein}/compensation`)
      .then((r) => r.json())
      .then((d: CompensationResponse) => {
        setData(d);
        if (d.years?.length) setSelectedYear(d.years[0].taxYear);
      })
      .finally(() => setLoading(false));
  }, [ein]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold text-lg mb-4">Executive Compensation (Schedule J)</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.years?.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold text-lg mb-2">Executive Compensation (Schedule J)</h3>
        <p className="text-sm text-muted-foreground">
          No Schedule J data found for this organization. Smaller nonprofits may
          not file Schedule J if compensation is below the $150,000 threshold.
        </p>
      </div>
    );
  }

  const activeYear = data.years.find((y) => y.taxYear === selectedYear);
  const records = activeYear?.records ?? [];

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h3 className="font-semibold text-lg">Executive Compensation (Schedule J / Part VII)</h3>
        <div className="flex gap-2">
          {data.years.map((y) => (
            <button
              key={y.taxYear}
              onClick={() => setSelectedYear(y.taxYear)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedYear === y.taxYear
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {y.taxYear}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Title</th>
              <th className="pb-2 pr-4 text-right font-medium">Base</th>
              <th className="pb-2 pr-4 text-right font-medium">Bonus</th>
              <th className="pb-2 pr-4 text-right font-medium">Deferred</th>
              <th className="pb-2 pr-4 text-right font-medium">Benefits</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 pr-4 font-medium">{rec.name}</td>
                <td className="py-2 pr-4 text-muted-foreground max-w-[180px] truncate">{rec.title || "—"}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCurrency(rec.baseCompensation, { compact: true })}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCurrency(rec.bonusCompensation, { compact: true })}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCurrency(rec.deferredCompensation, { compact: true })}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCurrency(rec.nontaxableBenefits, { compact: true })}
                </td>
                <td className="py-2 text-right tabular-nums font-semibold">
                  {formatCurrency(rec.totalCompensation, { compact: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Source: IRS Form 990 Schedule J / Part VII filed with the IRS.
        Data via AWS S3 public dataset.
      </p>
    </div>
  );
}
