import { prisma } from "@/lib/db";
import { computeAllMetrics } from "@/lib/metrics/derived-metrics";
import type {
  Organization,
  OrganizationWithFilings,
  SearchFilters,
  SearchResult,
  SimilarOrganization,
  Filing,
  DerivedMetrics,
} from "@/types";
import type {
  NonprofitDataProvider,
  SimilarityStrategy,
  LocationFilter,
} from "./types";

function mapOrg(
  o: Awaited<ReturnType<typeof prisma.organization.findUnique>> & {
    filings?: Awaited<ReturnType<typeof prisma.filing.findMany>>;
    derivedMetrics?: Awaited<ReturnType<typeof prisma.derivedMetrics.findMany>>;
  }
): OrganizationWithFilings {
  const filings: Filing[] = (o?.filings ?? []).map((f) => ({
    id: f.id,
    organizationId: f.organizationId,
    ein: f.ein,
    taxYear: f.taxYear,
    filedAt: f.filedAt?.toISOString(),
    totalRevenue: f.totalRevenue ?? undefined,
    totalExpenses: f.totalExpenses ?? undefined,
    netIncome: f.netIncome ?? undefined,
    totalContributions: f.totalContributions ?? undefined,
    programServiceRevenue: f.programServiceRevenue ?? undefined,
    investmentIncome: f.investmentIncome ?? undefined,
    otherRevenue: f.otherRevenue ?? undefined,
    totalAssets: f.totalAssets ?? undefined,
    totalLiabilities: f.totalLiabilities ?? undefined,
    netAssets: f.netAssets ?? undefined,
    programExpenses: f.programExpenses ?? undefined,
    adminExpenses: f.adminExpenses ?? undefined,
    fundraisingExpenses: f.fundraisingExpenses ?? undefined,
    executiveCompensation: f.executiveCompensation ?? undefined,
    employeeCount: f.employeeCount ?? undefined,
    totalGrants: f.totalGrants ?? undefined,
  }));

  const derivedMetrics: DerivedMetrics[] = (o?.derivedMetrics ?? []).map((m) => ({
    id: m.id,
    organizationId: m.organizationId,
    ein: m.ein,
    taxYear: m.taxYear,
    programExpenseRatio: m.programExpenseRatio ?? undefined,
    adminRatio: m.adminRatio ?? undefined,
    fundraisingRatio: m.fundraisingRatio ?? undefined,
    revenueGrowthYoY: m.revenueGrowthYoY ?? undefined,
    assetGrowthYoY: m.assetGrowthYoY ?? undefined,
    netMargin: m.netMargin ?? undefined,
    liquidityRatio: m.liquidityRatio ?? undefined,
  }));

  const sortedFilings = [...filings].sort((a, b) => b.taxYear - a.taxYear);

  return {
    id: o!.id,
    ein: o!.ein,
    name: o!.name,
    city: o!.city,
    state: o!.state,
    zip: o!.zip ?? undefined,
    nteeCode: o!.nteeCode,
    nteeCategory: o!.nteeCategory,
    mission: o!.mission ?? undefined,
    website: o!.website ?? undefined,
    ruling: o!.ruling ?? undefined,
    subsection: o!.subsection ?? undefined,
    filings,
    derivedMetrics,
    latestFiling: sortedFilings[0],
    latestMetrics: derivedMetrics.sort((a, b) => b.taxYear - a.taxYear)[0],
  };
}

const INCLUDE = {
  filings: { orderBy: { taxYear: "desc" as const } },
  derivedMetrics: { orderBy: { taxYear: "desc" as const } },
};

export class PrismaProvider implements NonprofitDataProvider {
  async searchOrganizations(
    query: string,
    filters: SearchFilters = {},
    page = 1,
    pageSize = 10
  ): Promise<SearchResult> {
    const where: NonNullable<Parameters<typeof prisma.organization.findMany>[0]>["where"] = {};

    if (query.trim()) {
      const q = query.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { ein: { contains: q.replace(/-/g, "") } },
        { city: { contains: q, mode: "insensitive" } },
        { state: { equals: q.toUpperCase() } },
        { nteeCategory: { contains: q, mode: "insensitive" } },
      ];
    }

    if (filters.state) where.state = { equals: filters.state.toUpperCase() };
    if (filters.city) where.city = { contains: filters.city, mode: "insensitive" };
    if (filters.nteeCode) where.nteeCode = { startsWith: filters.nteeCode };
    if (filters.nteeCategory) where.nteeCategory = filters.nteeCategory;

    const [total, rows] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
    ]);

    const organizations: Organization[] = rows.map((r) => ({
      id: r.id,
      ein: r.ein,
      name: r.name,
      city: r.city,
      state: r.state,
      zip: r.zip ?? undefined,
      nteeCode: r.nteeCode,
      nteeCategory: r.nteeCategory,
      mission: r.mission ?? undefined,
      website: r.website ?? undefined,
      ruling: r.ruling ?? undefined,
      subsection: r.subsection ?? undefined,
    }));

    return { organizations, total, page, pageSize };
  }

  async getOrganizationByEin(ein: string): Promise<OrganizationWithFilings | null> {
    const normalized = ein.replace(/-/g, "");
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ ein }, { ein: normalized }],
      },
      include: INCLUDE,
    });
    if (!org) return null;
    return mapOrg(org);
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

    const targetRevenue = target.latestFiling?.totalRevenue ?? 0;
    const nteePrefix = target.nteeCode.charAt(0);

    const candidates = await prisma.organization.findMany({
      where: {
        ein: { not: ein },
        OR: [
          { nteeCode: { startsWith: nteePrefix } },
          { state: target.state },
        ],
      },
      take: 30,
      include: INCLUDE,
    });

    return candidates
      .map((c) => {
        const mapped = mapOrg(c);
        const tags: SimilarOrganization["similarityTags"] = [];
        if (c.nteeCode.charAt(0) === nteePrefix) tags.push("same-category");
        if (c.nteeCode === target.nteeCode) tags.push("same-ntee");
        if (c.state === target.state) tags.push("same-state");
        if (c.city.toLowerCase() === target.city.toLowerCase()) tags.push("same-city");
        const rev = mapped.latestFiling?.totalRevenue ?? 0;
        if (targetRevenue > 0) {
          const ratio = rev / targetRevenue;
          if (ratio >= 0.3 && ratio <= 3.0) tags.push("similar-size");
        }
        return { ...mapped, similarityTags: tags, score: tags.length };
      })
      .filter((s) => s.similarityTags.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _s, ...rest }) => rest);
  }

  async getLocalOrganizations(
    location: LocationFilter,
    filters: Pick<SearchFilters, "nteeCode" | "nteeCategory"> = {},
    limit = 10
  ): Promise<Organization[]> {
    const where: NonNullable<Parameters<typeof prisma.organization.findMany>[0]>["where"] = {};
    if (location.state) where.state = location.state.toUpperCase();
    if (location.city) where.city = { contains: location.city, mode: "insensitive" };
    if (filters.nteeCode) where.nteeCode = { startsWith: filters.nteeCode };
    if (filters.nteeCategory) where.nteeCategory = filters.nteeCategory;

    const rows = await prisma.organization.findMany({ where, take: limit });
    return rows.map((r) => ({
      id: r.id, ein: r.ein, name: r.name, city: r.city, state: r.state,
      zip: r.zip ?? undefined, nteeCode: r.nteeCode, nteeCategory: r.nteeCategory,
      mission: r.mission ?? undefined, website: r.website ?? undefined,
      ruling: r.ruling ?? undefined, subsection: r.subsection ?? undefined,
    }));
  }
}
