import { Suspense } from "react";
import { dataProvider } from "@/lib/providers";
import { NonprofitCard } from "@/components/NonprofitCard";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { SearchFilters } from "@/types";

interface SearchPageProps {
  searchParams: { q?: string; state?: string; category?: string; page?: string };
}

async function Results({ searchParams }: SearchPageProps) {
  const q = searchParams.q ?? "";
  const filters: SearchFilters = {};
  if (searchParams.state) filters.state = searchParams.state;
  if (searchParams.category) filters.nteeCategory = searchParams.category;
  const page = parseInt(searchParams.page ?? "1", 10);

  const { organizations, total } = await dataProvider.searchOrganizations(q, filters, page, 12);

  if (total === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No results found"
        description={`No nonprofits match "${q}". Try a different name, EIN, or location.`}
      />
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {total} result{total !== 1 ? "s" : ""} for{" "}
        <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <NonprofitCard key={org.ein} org={org} />
        ))}
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-5 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q ?? "";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl font-bold mb-4">
          {q ? `Search results` : "Browse Nonprofits"}
        </h1>
        <SearchBar defaultValue={q} size="default" />
      </div>

      {/* Active filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {searchParams.state && (
          <Badge variant="secondary">State: {searchParams.state}</Badge>
        )}
        {searchParams.category && (
          <Badge variant="secondary">Category: {searchParams.category}</Badge>
        )}
      </div>

      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
