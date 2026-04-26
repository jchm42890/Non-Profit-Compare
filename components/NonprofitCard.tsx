import Link from "next/link";
import { MapPin, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { formatCurrency, formatEin } from "@/lib/utils/format";
import type { Organization, SimilarOrganization } from "@/types";

interface NonprofitCardProps {
  org: Organization | SimilarOrganization;
  latestRevenue?: number;
  showSimilarityTags?: boolean;
}

function isSimilar(org: Organization | SimilarOrganization): org is SimilarOrganization {
  return "similarityTags" in org;
}

const TAG_LABELS: Record<string, string> = {
  "same-category": "Same Category",
  "same-state": "Same State",
  "same-city": "Same City",
  "similar-size": "Similar Size",
  "same-ntee": "Same NTEE",
};

export function NonprofitCard({ org, latestRevenue, showSimilarityTags = false }: NonprofitCardProps) {
  const entry = {
    ein: org.ein,
    name: org.name,
    city: org.city,
    state: org.state,
    nteeCategory: org.nteeCategory,
  };

  const revenue = latestRevenue ?? (isSimilar(org) ? org.latestFiling?.totalRevenue : undefined);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/nonprofit/${org.ein}`}
              className="font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2"
            >
              {org.name}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {org.city}, {org.state}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {org.nteeCategory}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              EIN: {formatEin(org.ein)}
            </div>
          </div>
          <AddToCompareButton entry={entry} />
        </div>

        {revenue != null && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground">Latest Revenue </span>
            <span className="text-sm font-semibold">{formatCurrency(revenue, { compact: true })}</span>
          </div>
        )}

        {showSimilarityTags && isSimilar(org) && org.similarityTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {org.similarityTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                {TAG_LABELS[tag] ?? tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
