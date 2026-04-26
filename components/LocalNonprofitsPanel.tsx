import { NonprofitCard } from "@/components/NonprofitCard";
import { EmptyState } from "@/components/EmptyState";
import { MapPin } from "lucide-react";
import type { Organization } from "@/types";

interface LocalNonprofitsPanelProps {
  orgs: Organization[];
  city: string;
  state: string;
}

export function LocalNonprofitsPanel({ orgs, city, state }: LocalNonprofitsPanelProps) {
  if (orgs.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No local nonprofits found"
        description={`No other nonprofits found in ${city}, ${state}.`}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orgs.map((org) => (
        <NonprofitCard key={org.ein} org={org} />
      ))}
    </div>
  );
}
