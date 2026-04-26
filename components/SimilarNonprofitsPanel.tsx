import { NonprofitCard } from "@/components/NonprofitCard";
import { EmptyState } from "@/components/EmptyState";
import { Users } from "lucide-react";
import type { SimilarOrganization } from "@/types";

interface SimilarNonprofitsPanelProps {
  orgs: SimilarOrganization[];
}

export function SimilarNonprofitsPanel({ orgs }: SimilarNonprofitsPanelProps) {
  if (orgs.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No similar nonprofits found"
        description="Try expanding your search to find comparable organizations."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orgs.map((org) => (
        <NonprofitCard
          key={org.ein}
          org={org}
          showSimilarityTags
        />
      ))}
    </div>
  );
}
