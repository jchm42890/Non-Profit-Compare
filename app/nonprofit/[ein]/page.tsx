import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Globe, Calendar, Hash, Tag, ArrowLeft } from "lucide-react";
import { dataProvider } from "@/lib/providers";
import { KPIGrid } from "@/components/KPIGrid";
import { TrendChart } from "@/components/TrendChart";
import { CompensationTable } from "@/components/CompensationTable";
import { SimilarNonprofitsPanel } from "@/components/SimilarNonprofitsPanel";
import { LocalNonprofitsPanel } from "@/components/LocalNonprofitsPanel";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatEin, formatCurrency } from "@/lib/utils/format";

interface NonprofitPageProps {
  params: { ein: string };
}

export async function generateMetadata({ params }: NonprofitPageProps) {
  const org = await dataProvider.getOrganizationByEin(params.ein);
  if (!org) return { title: "Not found" };
  return {
    title: `${org.name} — Nonprofit Compare`,
    description: org.mission ?? `Form 990 data for ${org.name}`,
  };
}

export default async function NonprofitPage({ params }: NonprofitPageProps) {
  const [org, similar, local] = await Promise.all([
    dataProvider.getOrganizationByEin(params.ein),
    dataProvider.getSimilarOrganizations(params.ein, "combined", 6),
    (async () => {
      const o = await dataProvider.getOrganizationByEin(params.ein);
      if (!o) return [];
      return dataProvider.getLocalOrganizations({ city: o.city, state: o.state }, {}, 6);
    })(),
  ]);

  if (!org) notFound();

  const latestFiling = org.latestFiling;
  const latestMetrics = org.latestMetrics;

  const entry = {
    ein: org.ein,
    name: org.name,
    city: org.city,
    state: org.state,
    nteeCategory: org.nteeCategory,
  };

  // Filter out self from local
  const localFiltered = local.filter((o) => o.ein !== org.ein);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href="/search">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to search
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary">{org.nteeCategory}</Badge>
            {org.subsection && <Badge variant="outline">{org.subsection}</Badge>}
          </div>
          <h1 className="text-3xl font-bold">{org.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {org.city}, {org.state} {org.zip}
            </span>
            <span className="flex items-center gap-1.5">
              <Hash className="h-4 w-4" />
              EIN {formatEin(org.ein)}
            </span>
            <span className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              NTEE {org.nteeCode}
            </span>
            {org.ruling && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Founded {org.ruling}
              </span>
            )}
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Globe className="h-4 w-4" />
                Website
              </a>
            )}
          </div>
          {org.mission && (
            <p className="mt-4 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {org.mission}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <AddToCompareButton entry={entry} size="default" />
        </div>
      </div>

      <Separator className="mb-8" />

      {/* KPIs */}
      {latestFiling && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Key Metrics — {latestFiling.taxYear}
          </h2>
          <KPIGrid filing={latestFiling} metrics={latestMetrics} />
        </section>
      )}

      {/* Charts */}
      {org.filings.length > 1 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Financial Trends</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Revenue, Expenses & Assets</h3>
              <TrendChart filings={org.filings} metrics={org.derivedMetrics} type="financial" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Expense Ratios by Year</h3>
              <TrendChart filings={org.filings} metrics={org.derivedMetrics} type="ratios" />
            </div>
          </div>
        </section>
      )}

      {/* Filing history */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Filing History</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Year", "Revenue", "Expenses", "Net Income", "Assets", "Program %"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...org.filings]
                .sort((a, b) => b.taxYear - a.taxYear)
                .map((f) => {
                  const m = org.derivedMetrics.find((dm) => dm.taxYear === f.taxYear);
                  return (
                    <tr key={f.taxYear} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{f.taxYear}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(f.totalRevenue, { compact: true })}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(f.totalExpenses, { compact: true })}</td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className={f.netIncome != null && f.netIncome >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(f.netIncome, { compact: true })}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(f.totalAssets, { compact: true })}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {m?.programExpenseRatio != null
                          ? `${(m.programExpenseRatio * 100).toFixed(1)}%`
                          : "N/A"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Compensation */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Executive Compensation</h2>
        <CompensationTable ein={org.ein} />
      </section>

      {/* Similar orgs */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Similar Nonprofits</h2>
        <SimilarNonprofitsPanel orgs={similar} />
      </section>

      {/* Local orgs */}
      {localFiltered.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            More in {org.city}, {org.state}
          </h2>
          <LocalNonprofitsPanel orgs={localFiltered} city={org.city} state={org.state} />
        </section>
      )}
    </div>
  );
}
