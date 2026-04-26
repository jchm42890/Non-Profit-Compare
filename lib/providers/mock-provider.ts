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
import { computeAllMetrics } from "@/lib/metrics/derived-metrics";

// ---------------------------------------------------------------------------
// Seed data — 14 realistic nonprofits across categories, sizes, and locations
// ---------------------------------------------------------------------------

const ORGS: OrganizationWithFilings[] = [
  {
    id: "org_1",
    ein: "13-1837418",
    name: "American Red Cross",
    city: "Washington",
    state: "DC",
    zip: "20006",
    nteeCode: "P20",
    nteeCategory: "Human Services",
    mission:
      "Prevents and alleviates human suffering in the face of emergencies by mobilizing the power of volunteers and the generosity of donors.",
    website: "https://www.redcross.org",
    ruling: 1900,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_2",
    ein: "13-1788491",
    name: "Doctors Without Borders USA",
    city: "New York",
    state: "NY",
    zip: "10006",
    nteeCode: "E86",
    nteeCategory: "Health Care",
    mission:
      "Provides emergency medical care to people affected by conflict, epidemics, disasters, or exclusion from health care.",
    website: "https://www.doctorswithoutborders.org",
    ruling: 1971,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_3",
    ein: "53-0196605",
    name: "National Geographic Society",
    city: "Washington",
    state: "DC",
    zip: "20036",
    nteeCode: "U21",
    nteeCategory: "Science & Technology",
    mission:
      "Inspires people to care about the planet through exploration, science, technology, and storytelling.",
    website: "https://www.nationalgeographic.org",
    ruling: 1890,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_4",
    ein: "94-1312655",
    name: "YMCA of San Francisco",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    nteeCode: "P23",
    nteeCategory: "Human Services",
    mission:
      "Strengthens community through youth development, healthy living, and social responsibility.",
    website: "https://www.ymcasf.org",
    ruling: 1853,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_5",
    ein: "23-7327691",
    name: "Feeding America",
    city: "Chicago",
    state: "IL",
    zip: "60606",
    nteeCode: "K31",
    nteeCategory: "Food, Agriculture & Nutrition",
    mission:
      "Advances change in America by ensuring equitable access to nutritious food for all.",
    website: "https://www.feedingamerica.org",
    ruling: 1977,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_6",
    ein: "13-5562162",
    name: "Save the Children Federation",
    city: "Norwalk",
    state: "CT",
    zip: "06851",
    nteeCode: "O20",
    nteeCategory: "Youth Development",
    mission:
      "Creates lasting change for children in need in the United States and around the world.",
    website: "https://www.savethechildren.org",
    ruling: 1932,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_7",
    ein: "04-2103594",
    name: "Partners in Health",
    city: "Boston",
    state: "MA",
    zip: "02199",
    nteeCode: "E86",
    nteeCategory: "Health Care",
    mission:
      "Provides a preferential option for the poor in health care by placing the needs of the vulnerable at the center.",
    website: "https://www.pih.org",
    ruling: 1987,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_8",
    ein: "52-1693387",
    name: "World Wildlife Fund",
    city: "Washington",
    state: "DC",
    zip: "20037",
    nteeCode: "C30",
    nteeCategory: "Environment",
    mission:
      "Conserves nature and reduces the most pressing threats to the diversity of life on Earth.",
    website: "https://www.worldwildlife.org",
    ruling: 1961,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_9",
    ein: "94-2703833",
    name: "Silicon Valley Community Foundation",
    city: "Mountain View",
    state: "CA",
    zip: "94043",
    nteeCode: "T31",
    nteeCategory: "Philanthropy & Voluntarism",
    mission:
      "Mobilizes philanthropic capital to create a more just and equitable world.",
    website: "https://www.siliconvalleycf.org",
    ruling: 1993,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_10",
    ein: "13-3262114",
    name: "Robin Hood Foundation",
    city: "New York",
    state: "NY",
    zip: "10011",
    nteeCode: "T30",
    nteeCategory: "Philanthropy & Voluntarism",
    mission:
      "Fights poverty in New York City by funding and partnering with the most effective nonprofits.",
    website: "https://www.robinhood.org",
    ruling: 1988,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_11",
    ein: "36-2423707",
    name: "Chicago Community Trust",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    nteeCode: "T31",
    nteeCategory: "Philanthropy & Voluntarism",
    mission:
      "Connects donors to the most pressing needs in metropolitan Chicago and helps nonprofits do their best work.",
    website: "https://www.cct.org",
    ruling: 1915,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_12",
    ein: "58-1788494",
    name: "Atlanta Community Food Bank",
    city: "Atlanta",
    state: "GA",
    zip: "30310",
    nteeCode: "K31",
    nteeCategory: "Food, Agriculture & Nutrition",
    mission:
      "Works to end hunger in the 29-county metro Atlanta area and the 4-county northeast Georgia.",
    website: "https://www.acfb.org",
    ruling: 1979,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_13",
    ein: "82-2230781",
    name: "Khan Academy",
    city: "Mountain View",
    state: "CA",
    zip: "94041",
    nteeCode: "B60",
    nteeCategory: "Education",
    mission:
      "Provides a free, world-class education for anyone, anywhere through online tools.",
    website: "https://www.khanacademy.org",
    ruling: 2007,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
  {
    id: "org_14",
    ein: "04-3188271",
    name: "City Year Inc",
    city: "Boston",
    state: "MA",
    zip: "02210",
    nteeCode: "O50",
    nteeCategory: "Youth Development",
    mission:
      "Keeps students in school and on track to graduate by partnering with high-need schools.",
    website: "https://www.cityyear.org",
    ruling: 1988,
    subsection: "501(c)(3)",
    filings: [],
    derivedMetrics: [],
  },
];

// ---------------------------------------------------------------------------
// Generate realistic multi-year filings for each org
// ---------------------------------------------------------------------------

function makeFilings(
  orgId: string,
  ein: string,
  baseRevenue: number,
  baseExpenses: number,
  baseAssets: number,
  growthRate = 0.05
): Filing[] {
  const years = [2020, 2021, 2022, 2023];
  return years.map((year, i) => {
    const g = Math.pow(1 + growthRate, i);
    const rev = Math.round(baseRevenue * g);
    const exp = Math.round(baseExpenses * g * (0.92 + Math.random() * 0.1));
    const programPct = 0.72 + Math.random() * 0.1;
    const adminPct = 0.1 + Math.random() * 0.05;
    const fundraisingPct = 1 - programPct - adminPct;
    const assets = Math.round(baseAssets * g);
    const liabilities = Math.round(assets * (0.2 + Math.random() * 0.1));
    const contribPct = 0.55 + Math.random() * 0.2;

    return {
      id: `fil_${orgId}_${year}`,
      organizationId: orgId,
      ein,
      taxYear: year,
      totalRevenue: rev,
      totalExpenses: exp,
      netIncome: rev - exp,
      totalContributions: Math.round(rev * contribPct),
      programServiceRevenue: Math.round(rev * (1 - contribPct) * 0.7),
      investmentIncome: Math.round(rev * 0.02),
      otherRevenue: Math.round(rev * 0.03),
      totalAssets: assets,
      totalLiabilities: liabilities,
      netAssets: assets - liabilities,
      programExpenses: Math.round(exp * programPct),
      adminExpenses: Math.round(exp * adminPct),
      fundraisingExpenses: Math.round(exp * fundraisingPct),
      executiveCompensation: Math.round(Math.min(rev * 0.003, 800_000)),
      employeeCount: Math.round((exp / 65_000) * (0.8 + Math.random() * 0.4)),
      totalGrants: Math.round(rev * contribPct * 0.6),
    };
  });
}

const ORG_FINANCIALS: Array<{
  id: string;
  ein: string;
  baseRevenue: number;
  baseExpenses: number;
  baseAssets: number;
  growthRate: number;
}> = [
  { id: "org_1",  ein: "13-1837418", baseRevenue: 2_900_000_000, baseExpenses: 2_800_000_000, baseAssets: 1_200_000_000, growthRate: 0.03 },
  { id: "org_2",  ein: "13-1788491", baseRevenue: 440_000_000,   baseExpenses: 420_000_000,   baseAssets: 180_000_000,   growthRate: 0.07 },
  { id: "org_3",  ein: "53-0196605", baseRevenue: 290_000_000,   baseExpenses: 260_000_000,   baseAssets: 950_000_000,   growthRate: 0.04 },
  { id: "org_4",  ein: "94-1312655", baseRevenue: 72_000_000,    baseExpenses: 68_000_000,    baseAssets: 55_000_000,    growthRate: 0.06 },
  { id: "org_5",  ein: "23-7327691", baseRevenue: 3_500_000_000, baseExpenses: 3_400_000_000, baseAssets: 700_000_000,   growthRate: 0.08 },
  { id: "org_6",  ein: "13-5562162", baseRevenue: 670_000_000,   baseExpenses: 640_000_000,   baseAssets: 320_000_000,   growthRate: 0.05 },
  { id: "org_7",  ein: "04-2103594", baseRevenue: 520_000_000,   baseExpenses: 490_000_000,   baseAssets: 210_000_000,   growthRate: 0.09 },
  { id: "org_8",  ein: "52-1693387", baseRevenue: 310_000_000,   baseExpenses: 285_000_000,   baseAssets: 480_000_000,   growthRate: 0.04 },
  { id: "org_9",  ein: "94-2703833", baseRevenue: 1_100_000_000, baseExpenses: 900_000_000,   baseAssets: 8_200_000_000, growthRate: 0.12 },
  { id: "org_10", ein: "13-3262114", baseRevenue: 195_000_000,   baseExpenses: 175_000_000,   baseAssets: 230_000_000,   growthRate: 0.06 },
  { id: "org_11", ein: "36-2423707", baseRevenue: 650_000_000,   baseExpenses: 580_000_000,   baseAssets: 4_100_000_000, growthRate: 0.07 },
  { id: "org_12", ein: "58-1788494", baseRevenue: 89_000_000,    baseExpenses: 82_000_000,    baseAssets: 42_000_000,    growthRate: 0.06 },
  { id: "org_13", ein: "82-2230781", baseRevenue: 58_000_000,    baseExpenses: 54_000_000,    baseAssets: 34_000_000,    growthRate: 0.15 },
  { id: "org_14", ein: "04-3188271", baseRevenue: 145_000_000,   baseExpenses: 138_000_000,   baseAssets: 58_000_000,    growthRate: 0.04 },
];

// Hydrate filings and derived metrics into each org
for (const org of ORGS) {
  const fin = ORG_FINANCIALS.find((f) => f.id === org.id);
  if (!fin) continue;
  org.filings = makeFilings(
    fin.id,
    fin.ein,
    fin.baseRevenue,
    fin.baseExpenses,
    fin.baseAssets,
    fin.growthRate
  );
  org.derivedMetrics = computeAllMetrics(org.ein, org.id, org.filings);
  org.latestFiling = org.filings[org.filings.length - 1];
  org.latestMetrics = org.derivedMetrics[org.derivedMetrics.length - 1];
}

// ---------------------------------------------------------------------------
// MockProvider implementation
// ---------------------------------------------------------------------------

function stripFilings(org: OrganizationWithFilings): Organization {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { filings, derivedMetrics, latestFiling, latestMetrics, ...base } = org;
  return base;
}

function matchesFilters(org: OrganizationWithFilings, filters: SearchFilters): boolean {
  if (filters.state && org.state.toUpperCase() !== filters.state.toUpperCase()) return false;
  if (filters.city && !org.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
  if (filters.nteeCode && !org.nteeCode.startsWith(filters.nteeCode)) return false;
  if (filters.nteeCategory && org.nteeCategory !== filters.nteeCategory) return false;
  if (filters.minRevenue || filters.maxRevenue) {
    const rev = org.latestFiling?.totalRevenue ?? 0;
    if (filters.minRevenue && rev < filters.minRevenue) return false;
    if (filters.maxRevenue && rev > filters.maxRevenue) return false;
  }
  return true;
}

export class MockProvider implements NonprofitDataProvider {
  private orgs: OrganizationWithFilings[] = ORGS;

  async searchOrganizations(
    query: string,
    filters: SearchFilters = {},
    page = 1,
    pageSize = 10
  ): Promise<SearchResult> {
    const q = query.trim().toLowerCase();

    let results = this.orgs.filter((org) => {
      if (q) {
        const matchName = org.name.toLowerCase().includes(q);
        const matchEin = org.ein.replace(/-/g, "").includes(q.replace(/-/g, ""));
        const matchCity = org.city.toLowerCase().includes(q);
        const matchState = org.state.toLowerCase().includes(q);
        const matchCat = org.nteeCategory.toLowerCase().includes(q);
        if (!matchName && !matchEin && !matchCity && !matchState && !matchCat) return false;
      }
      return matchesFilters(org, filters);
    });

    const total = results.length;
    const start = (page - 1) * pageSize;
    results = results.slice(start, start + pageSize);

    return {
      organizations: results.map(stripFilings),
      total,
      page,
      pageSize,
    };
  }

  async getOrganizationByEin(ein: string): Promise<OrganizationWithFilings | null> {
    const normalized = ein.replace(/-/g, "");
    return (
      this.orgs.find((o) => o.ein.replace(/-/g, "") === normalized) ?? null
    );
  }

  async getOrganizationFilings(ein: string): Promise<Filing[]> {
    const org = await this.getOrganizationByEin(ein);
    if (!org) return [];
    return [...org.filings].sort((a, b) => b.taxYear - a.taxYear);
  }

  async getOrganizationMetrics(ein: string): Promise<DerivedMetrics[]> {
    const org = await this.getOrganizationByEin(ein);
    if (!org) return [];
    return [...org.derivedMetrics].sort((a, b) => b.taxYear - a.taxYear);
  }

  async getSimilarOrganizations(
    ein: string,
    strategy: SimilarityStrategy = "combined",
    limit = 6
  ): Promise<SimilarOrganization[]> {
    const target = await this.getOrganizationByEin(ein);
    if (!target) return [];

    const targetRevenue = target.latestFiling?.totalRevenue ?? 0;
    const targetNteePrefix = target.nteeCode.charAt(0);

    const scored = this.orgs
      .filter((o) => o.ein !== target.ein)
      .map((org) => {
        const tags: SimilarOrganization["similarityTags"] = [];
        let score = 0;

        const orgNteePrefix = org.nteeCode.charAt(0);
        if (orgNteePrefix === targetNteePrefix) {
          tags.push("same-category");
          score += 3;
        }
        if (org.nteeCode === target.nteeCode) {
          tags.push("same-ntee");
          score += 2;
        }
        if (org.state === target.state) {
          tags.push("same-state");
          score += 2;
        }
        if (org.city.toLowerCase() === target.city.toLowerCase()) {
          tags.push("same-city");
          score += 3;
        }
        const rev = org.latestFiling?.totalRevenue ?? 0;
        if (targetRevenue > 0) {
          const ratio = rev / targetRevenue;
          if (ratio >= 0.3 && ratio <= 3.0) {
            tags.push("similar-size");
            score += 1;
          }
        }

        if (strategy === "ntee") score = tags.includes("same-category") ? 10 : 0;
        if (strategy === "geography") score = tags.includes("same-state") ? 10 : 0;
        if (strategy === "size") score = tags.includes("similar-size") ? 10 : 0;

        return { org, tags, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ org, tags }) => ({
      ...stripFilings(org),
      similarityTags: tags,
      latestFiling: org.latestFiling,
    }));
  }

  async getLocalOrganizations(
    location: LocationFilter,
    filters: Pick<SearchFilters, "nteeCode" | "nteeCategory"> = {},
    limit = 10
  ): Promise<Organization[]> {
    let results = this.orgs.filter((org) => {
      if (location.state && org.state.toUpperCase() !== location.state.toUpperCase()) return false;
      if (location.city && !org.city.toLowerCase().includes(location.city.toLowerCase())) return false;
      if (filters.nteeCode && !org.nteeCode.startsWith(filters.nteeCode)) return false;
      if (filters.nteeCategory && org.nteeCategory !== filters.nteeCategory) return false;
      return true;
    });

    return results.slice(0, limit).map(stripFilings);
  }
}

export const mockProvider = new MockProvider();
