"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { ScheduleJResult } from "@/lib/irs/fetch-schedule-j";
import { formatCurrency } from "@/lib/utils/format";

interface SummaryRow {
  taxYear: number;
  totalOfficerComp: number;
  pdfUrl: string | null;
  hasXml: boolean;
}

interface CompensationResponse {
  ein: string;
  years: ScheduleJResult[];
  summary: SummaryRow[];
  xmlAvailable: boolean;
  note: string | null;
  error?: string;
}

interface Props {
  ein: string;
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
        <h3 className="font-semibold text-lg mb-4">Executive Compensation</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasSummary = (data?.summary?.length ?? 0) > 0;
  const hasXml = data?.xmlAvailable && (data?.years?.length ?? 0) > 0;
  const activeYear = data?.years?.find((y) => y.taxYear === selectedYear);

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <h3 className="font-semibold text-lg">Executive Compensation</h3>

      {/* Aggregate totals — always shown */}
      {hasSummary && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Total Officer Compensation (from Form 990 Part IX)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-6 font-medium">Year</th>
                  <th className="pb-2 pr-6 text-right font-medium">Total Officer Comp</th>
                  <th className="pb-2 font-medium">Filing</th>
                </tr>
              </thead>
              <tbody>
                {data!.summary.map((row) => (
                  <tr key={row.taxYear} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-6 font-medium">{row.taxYear}</td>
                    <td className="py-2 pr-6 text-right tabular-nums font-semibold">
                      {formatCurrency(row.totalOfficerComp, { compact: false })}
                    </td>
                    <td className="py-2">
                      {row.pdfUrl ? (
                        <a
                          href={row.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          View 990 PDF
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule J detail — only when XML is available */}
      {hasXml && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
            <p className="text-sm font-medium text-muted-foreground">
              Individual Compensation Breakdown (Schedule J / Part VII)
            </p>
            <div className="flex gap-2">
              {data!.years.map((y) => (
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
                {(activeYear?.records ?? []).map((rec, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4 font-medium">{rec.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground max-w-[180px] truncate">
                      {rec.title || "—"}
                    </td>
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
        </div>
      )}

      {/* Note when XML is not available */}
      {data?.note && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium">Note: </span>{data.note}
        </div>
      )}

      {!hasSummary && !hasXml && (
        <p className="text-sm text-muted-foreground">
          No compensation data found for this organization.
        </p>
      )}

      <p className="text-xs text-muted-foreground border-t pt-3">
        Aggregated totals from ProPublica Nonprofit Explorer (IRS Form 990 Part IX).
        Individual breakdowns sourced from IRS 990 XML public dataset when available.
      </p>
    </div>
  );
}
