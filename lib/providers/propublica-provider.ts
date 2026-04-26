import type {
  NonprofitDataProvider,
  SimilarityStrategy,
  LocationFilter,
} from "./types";
import type {
  Organization,
  OrganizationWithFilings,
  SearchFilters,
  SearchResult,
  SimilarOrganization,
  Filing,
  DerivedMetrics,
} from "@/types";
import { NTEE_CATEGORIES } from "@/types";
import { computeAllMetrics } from "@/lib/metrics/derived-metrics";

const BASE =
  process.env.PROPUBLICA_API_BASE ??
  "https://projects.propublica.org/nonprofits/api/v2";

// ProPublica NTEE letter → numeric id used in their API filter
const NTEE_TO_ID: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10,
  K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19,
  T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26,
};

// ── Raw API shapes ────────────────────────────────────────────────────────────

interface PPOrg {
  ein: number;
  strein?: string;
  name: string;
  city: string;
  state: string;
  zipcode?: string;
  ntee_code?: string;
  raw_ntee_code?: string;
  subsection_code?: string;
  ruling_date?: string;
  asset_amount?: number;
  income_amount?: number;
  revenue_amount?: number;
  website?: string;
  mission?: string;
}

interface PPFiling {
  tax_prd_yr: string | number;
  totrevenue?: number;
  totfuncexpns?: number;
  totassetsend?: number;
  totliabend?: number;
  netassetsend?: number;
  totcntrbgfts?: number;
  totprgmrevnue?: number;
  invstmntinc?: number;
  othrincome?: number;
  compnsatncurrofcr?: number;
  profndraising?: number;
  adminexp?: number;
  noemployees?: number;
  grntstogovt?: number;
  grntstodmstc?: number;
  grntstoforgn?: number;
}

interface PPSearchResponse {
  total_results: number;
  organizations: PPOrg[];
}

interface PPDetailResponse {
  organization: PPOrg;
  filings_with_data: PPFiling[];
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function nteeCategory(code?: string): string {
  if (!code) return "Unknown";
  return NTEE_CATEGORIES[code.charAt(0).toUpperCase()] ?? "Unknown";
}

function einStr(ein: number | string): string {
  const s = String(ein).replace(/\D/g, "").padStart(9, "0");
  return `${s.slice(0, 2)}-${s.slice(2)}`;
}

function mapOrg(o: PPOrg): Organization {
  const nteeCode = o.ntee_code ?? o.raw_ntee_code ?? "Z99";
  return {
    id: String(o.ein),
    ein: einStr(o.ein),
    name: o.name,
    city: o.city ?? "",
    state: o.state ?? "",
    zip: o.zipcode,
    nteeCode,
    nteeCategory: nteeCategory(nteeCode),
    mission: o.mission ?? undefined,
    website: o.website ?? undefined,
    ruling: o.ruling_date
      ? parseInt(o.ruling_date.slice(0, 4), 10)
      : undefined,
    subsection: o.subsection_code ? `501(c)(${o.subsection_code})` : undefined,
  };
}

function mapFiling(f: PPFiling, ein: string, orgId: string): Filing {
  const year = parseInt(String(f.tax_prd_yr), 10);
  const programExpenses =
    (f.totfuncexpns ?? 0) - (f.adminexp ?? 0) - (f.profndraising ?? 0);
  const grants =
    (f.grntstogovt ?? 0) + (f.grntstodmstc ?? 0) + (f.grntstoforgn ?? 0);

  return {
    id: `${ein}-${year}`,
    organizationId: orgId,
    ein,
    taxYear: year,
    totalRevenue: f.totrevenue ?? undefined,
    totalExpenses: f.totfuncexpns ?? undefined,
    netIncome:
      f.totrevenue != null && f.totfuncexpns != null
        ? f.totrevenue - f.totfuncexpns
        : undefined,
    totalContributions: f.totcntrbgfts ?? undefined,
    programServiceRevenue: f.totprgmrevnue ?? undefined,
    investmentIncome: f.invstmntinc ?? undefined,
    otherRevenue: f.othrincome ?? undefined,
    totalAssets: f.totassetsend ?? undefined,
    totalLiabilities: f.totliabend ?? undefined,
    netAssets: f.netassetsend ?? undefined,
    programExpenses: programExpenses > 0 ? programExpenses : undefined,
    adminExpenses: f.adminexp ?? undefined,
    fundraisingExpenses: f.profndraising ?? undefined,
    executiveCompensation: f.compnsatncurrofcr ?? undefined,
    employeeCount: f.noemployees ?? undefined,
    totalGrants: grants > 0 ? grants : undefined,
  };
}

function buildOrgWithFilings(
  org: Organization,
  rawFilings: PPFiling[]
): OrganizationWithFilings {
  const filings = rawFilings
    .filter((f) => f.tax_prd_yr)
    .map((f) => mapFiling(f, org.ein, org.id))
    .sort((a, b) => b.taxYear - a.taxYear);

  const derivedMetrics: DerivedMetrics[] = computeAllMetrics(org.ein, org.id, filings);

  return {
    ...org,
    filings,
    derivedMetrics,
    latestFiling: filings[0],
    latestMetrics: derivedMetrics[0],
  };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function ppFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 }, // 1-hour Next.js cache
  });
  if (!res.ok) throw new Error(`ProPublica API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class ProPublicaProvider implements NonprofitDataProvider {
  async searchOrganizations(
    query: string,
    filters: SearchFilters = {},
    page = 1,
    pageSize = 10
  ): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filters.state) params.set("state[id]", filters.state.toUpperCase());
    if (filters.nteeCode) {
      const letter = filters.nteeCode.charAt(0).toUpperCase();
      const id = NTEE_TO_ID[letter];
      if (id) params.set("ntee[id]", String(id));
    }
    // ProPublica uses 0-based offset
    params.set("page", String(page - 1));

    const data = await ppFetch<PPSearchResponse>(
      `/search.json?${params.toString()}`
    );

    const organizations = (data.organizations ?? [])
      .slice(0, pageSize)
      .map(mapOrg);

    return {
      organizations,
      total: data.total_results ?? organizations.length,
      page,
      pageSize,
    };
  }

  async getOrganizationByEin(
    ein: string
  ): Promise<OrganizationWithFilings | null> {
    const normalized = ein.replace(/-/g, "");
    try {
      const data = await ppFetch<PPDetailResponse>(
        `/organizations/${normalized}.json`
      );
      const org = mapOrg(data.organization);
      return buildOrgWithFilings(org, data.filings_with_data ?? []);
    } catch {
      return null;
    }
  }

  async getOrganizationFilings(ein: string): Promise<Filing[]> {
    const org = await this.getOrganizationByEin(ein);
    return org?.filings ?? [];
  }

  async getOrganizationMetrics(ein: string): Promise<DerivedMetrics[]> {
    const org = await this.getOrganizationByEin(ein);
    return org?.derivedMetrics ?? [];
  }

  async getSimilarOrganizations(
    ein: string,
    _strategy: SimilarityStrategy = "combined",
    limit = 6
  ): Promise<SimilarOrganization[]> {
    const target = await this.getOrganizationByEin(ein);
    if (!target) return [];

    const nteePrefix = target.nteeCode.charAt(0);
    const data = await ppFetch<PPSearchResponse>(
      `/search.json?q=&state[id]=${target.state}&ntee[id]=${NTEE_TO_ID[nteePrefix] ?? ""}`
    );

    const targetRevenue = target.latestFiling?.totalRevenue ?? 0;

    return (data.organizations ?? [])
      .filter((o) => einStr(o.ein) !== target.ein)
      .slice(0, limit * 3)
      .map((o) => {
        const org = mapOrg(o);
        const tags: SimilarOrganization["similarityTags"] = [];
        if ((o.ntee_code ?? "").charAt(0) === nteePrefix) tags.push("same-category");
        if (o.ntee_code === target.nteeCode) tags.push("same-ntee");
        if (o.state === target.state) tags.push("same-state");
        if (o.city?.toLowerCase() === target.city.toLowerCase()) tags.push("same-city");
        const rev = o.revenue_amount ?? 0;
        if (targetRevenue > 0) {
          const ratio = rev / targetRevenue;
          if (ratio >= 0.3 && ratio <= 3.0) tags.push("similar-size");
        }
        return { ...org, similarityTags: tags, _score: tags.length };
      })
      .filter((s) => s.similarityTags.length > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score: _, ...rest }) => rest);
  }

  async getLocalOrganizations(
    location: LocationFilter,
    filters: Pick<SearchFilters, "nteeCode" | "nteeCategory"> = {},
    limit = 10
  ): Promise<Organization[]> {
    const params = new URLSearchParams();
    // Search by city name as query since ProPublica has no city filter
    if (location.city) params.set("q", location.city);
    if (location.state) params.set("state[id]", location.state.toUpperCase());
    if (filters.nteeCode) {
      const letter = filters.nteeCode.charAt(0).toUpperCase();
      const id = NTEE_TO_ID[letter];
      if (id) params.set("ntee[id]", String(id));
    }

    const data = await ppFetch<PPSearchResponse>(
      `/search.json?${params.toString()}`
    );

    return (data.organizations ?? [])
      .filter(
        (o) =>
          !location.city ||
          o.city?.toLowerCase().includes(location.city.toLowerCase())
      )
      .slice(0, limit)
      .map(mapOrg);
  }
}
