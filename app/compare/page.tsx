"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Trash2, BarChart3, ArrowRight } from "lucide-react";
import { useCompareStore } from "@/lib/compare/store";
import { CompareTable } from "@/components/CompareTable";
import { CompareCharts } from "@/components/CompareCharts";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrganizationWithFilings } from "@/types";

export default function ComparePage() {
  const { entries, remove, clear } = useCompareStore();
  const [orgs, setOrgs] = useState<OrganizationWithFilings[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Safe hydration — avoid SSR mismatch
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || entries.length === 0) {
      setOrgs([]);
      return;
    }
    setLoading(true);
    Promise.all(
      entries.map((e) =>
        fetch(`/api/nonprofit/${encodeURIComponent(e.ein)}`).then((r) => r.json())
      )
    )
      .then((results) => {
        setOrgs(results.filter(Boolean));
      })
      .finally(() => setLoading(false));
  }, [entries, hydrated]);

  if (!hydrated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Compare Nonprofits</h1>
        <EmptyState
          icon={BarChart3}
          title="No nonprofits selected"
          description='Search for nonprofits and click "Compare" to add them here. You can compare up to 6 at a time.'
          action={
            <Button asChild>
              <Link href="/search">
                Browse Nonprofits <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Compare Nonprofits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {entries.length} of 6 selected
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/search">
              Add more <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clear}
            className="text-destructive hover:text-destructive gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </Button>
        </div>
      </div>

      {/* Selected chips */}
      <div className="flex flex-wrap gap-2 mb-8 p-4 rounded-lg border bg-muted/30">
        {entries.map((entry) => (
          <div
            key={entry.ein}
            className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm shadow-sm"
          >
            <span className="font-medium">{entry.name}</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {entry.city}, {entry.state}
            </Badge>
            <button
              onClick={() => remove(entry.ein)}
              className="ml-1 rounded-full hover:bg-muted p-0.5 transition-colors"
              aria-label={`Remove ${entry.name}`}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : orgs.length > 0 ? (
        <div className="space-y-10">
          {/* Table */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Metrics Table</h2>
            <CompareTable orgs={orgs} />
            <p className="mt-2 text-xs text-muted-foreground">
              * Metrics based on most recent available filing year. N/A = data not available.
            </p>
          </section>

          {/* Charts */}
          {orgs.length >= 2 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Charts</h2>
              <CompareCharts orgs={orgs} />
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
