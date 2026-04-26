import type { NonprofitDataProvider, SimilarityStrategy, LocationFilter } from "./types";
import type { SearchFilters, SearchResult, OrganizationWithFilings, Organization, Filing, DerivedMetrics, SimilarOrganization } from "@/types";

// Explicitly wraps every provider method so failures and empty results
// on the primary gracefully retry on ProPublica.
function withProPublicaFallback(
  primary: NonprofitDataProvider,
  fallback: NonprofitDataProvider
): NonprofitDataProvider {
  return {
    async searchOrganizations(query: string, filters?: SearchFilters, page?: number, pageSize?: number): Promise<SearchResult> {
      try {
        const result = await primary.searchOrganizations(query, filters, page, pageSize);
        // Empty DB — fall through to real data
        if (result.organizations.length === 0 && query?.trim()) {
          return fallback.searchOrganizations(query, filters, page, pageSize);
        }
        return result;
      } catch {
        return fallback.searchOrganizations(query, filters, page, pageSize);
      }
    },

    async getOrganizationByEin(ein: string): Promise<OrganizationWithFilings | null> {
      try {
        const result = await primary.getOrganizationByEin(ein);
        if (!result) return fallback.getOrganizationByEin(ein);
        return result;
      } catch {
        return fallback.getOrganizationByEin(ein);
      }
    },

    async getOrganizationFilings(ein: string): Promise<Filing[]> {
      try {
        const result = await primary.getOrganizationFilings(ein);
        if (!result.length) return fallback.getOrganizationFilings(ein);
        return result;
      } catch {
        return fallback.getOrganizationFilings(ein);
      }
    },

    async getOrganizationMetrics(ein: string): Promise<DerivedMetrics[]> {
      try {
        return await primary.getOrganizationMetrics(ein);
      } catch {
        return fallback.getOrganizationMetrics(ein);
      }
    },

    async getSimilarOrganizations(ein: string, strategy?: SimilarityStrategy, limit?: number): Promise<SimilarOrganization[]> {
      try {
        const result = await primary.getSimilarOrganizations(ein, strategy, limit);
        if (!result.length) return fallback.getSimilarOrganizations(ein, strategy, limit);
        return result;
      } catch {
        return fallback.getSimilarOrganizations(ein, strategy, limit);
      }
    },

    async getLocalOrganizations(location: LocationFilter, filters?: Pick<SearchFilters, "nteeCode" | "nteeCategory">, limit?: number): Promise<Organization[]> {
      try {
        const result = await primary.getLocalOrganizations(location, filters, limit);
        if (!result.length) return fallback.getLocalOrganizations(location, filters, limit);
        return result;
      } catch {
        return fallback.getLocalOrganizations(location, filters, limit);
      }
    },
  };
}

function buildProvider(): NonprofitDataProvider {
  const { ProPublicaProvider } = require("./propublica-provider");
  const propublica: NonprofitDataProvider = new ProPublicaProvider();

  // Use DATA_PROVIDER (runtime) or fall back to NEXT_PUBLIC_ (may be build-baked)
  const name =
    process.env.DATA_PROVIDER ??
    process.env.NEXT_PUBLIC_DATA_PROVIDER ??
    "propublica";

  if (name === "mock") {
    const { MockProvider } = require("./mock-provider");
    return new MockProvider();
  }

  if (name === "prisma" && process.env.DATABASE_URL) {
    try {
      const { PrismaProvider } = require("./prisma-provider");
      const prisma: NonprofitDataProvider = new PrismaProvider();
      // Wrap so empty/erroring Prisma results fall back to ProPublica
      return withProPublicaFallback(prisma, propublica);
    } catch (e) {
      console.error("[provider] Prisma failed to initialise:", e);
    }
  }

  return propublica;
}

export const dataProvider: NonprofitDataProvider = buildProvider();
export type { NonprofitDataProvider } from "./types";
