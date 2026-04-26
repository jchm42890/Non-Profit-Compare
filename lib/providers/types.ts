import type {
  Organization,
  OrganizationWithFilings,
  SearchFilters,
  SearchResult,
  SimilarOrganization,
} from "@/types";

export type SimilarityStrategy = "ntee" | "geography" | "size" | "combined";

export interface LocationFilter {
  city?: string;
  state?: string;
  zip?: string;
  radiusMiles?: number;
}

export interface NonprofitDataProvider {
  /**
   * Search organizations by name, EIN, city, or state.
   */
  searchOrganizations(
    query: string,
    filters?: SearchFilters,
    page?: number,
    pageSize?: number
  ): Promise<SearchResult>;

  /**
   * Fetch full organization profile by EIN.
   */
  getOrganizationByEin(ein: string): Promise<OrganizationWithFilings | null>;

  /**
   * Fetch all filings for an organization (sorted newest first).
   */
  getOrganizationFilings(
    ein: string
  ): Promise<OrganizationWithFilings["filings"]>;

  /**
   * Fetch the latest derived metrics for an organization.
   */
  getOrganizationMetrics(
    ein: string
  ): Promise<OrganizationWithFilings["derivedMetrics"]>;

  /**
   * Find similar organizations using the given strategy.
   */
  getSimilarOrganizations(
    ein: string,
    strategy?: SimilarityStrategy,
    limit?: number
  ): Promise<SimilarOrganization[]>;

  /**
   * Find local organizations filtered by location and optional category.
   */
  getLocalOrganizations(
    location: LocationFilter,
    filters?: Pick<SearchFilters, "nteeCode" | "nteeCategory">,
    limit?: number
  ): Promise<Organization[]>;
}
