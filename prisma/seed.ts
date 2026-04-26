import { PrismaClient } from "@prisma/client";
import { computeAllMetrics } from "../lib/metrics/derived-metrics";

// Use a direct PrismaClient in the seed script (not the singleton)
// so it connects via DIRECT_URL and doesn't conflict with the app process.
const prisma = new PrismaClient();

const ORGS = [
  { ein: "13-1837418", name: "American Red Cross", city: "Washington", state: "DC", zip: "20006", nteeCode: "P20", nteeCategory: "Human Services", mission: "Prevents and alleviates human suffering in the face of emergencies.", ruling: 1900 },
  { ein: "13-1788491", name: "Doctors Without Borders USA", city: "New York", state: "NY", zip: "10006", nteeCode: "E86", nteeCategory: "Health Care", mission: "Provides emergency medical care to people affected by conflict, epidemics, or disasters.", ruling: 1971 },
  { ein: "53-0196605", name: "National Geographic Society", city: "Washington", state: "DC", zip: "20036", nteeCode: "U21", nteeCategory: "Science & Technology", mission: "Inspires people to care about the planet through exploration and storytelling.", ruling: 1890 },
  { ein: "94-1312655", name: "YMCA of San Francisco", city: "San Francisco", state: "CA", zip: "94105", nteeCode: "P23", nteeCategory: "Human Services", mission: "Strengthens community through youth development, healthy living, and social responsibility.", ruling: 1853 },
  { ein: "23-7327691", name: "Feeding America", city: "Chicago", state: "IL", zip: "60606", nteeCode: "K31", nteeCategory: "Food, Agriculture & Nutrition", mission: "Advances change in America by ensuring equitable access to nutritious food for all.", ruling: 1977 },
  { ein: "13-5562162", name: "Save the Children Federation", city: "Norwalk", state: "CT", zip: "06851", nteeCode: "O20", nteeCategory: "Youth Development", mission: "Creates lasting change for children in need in the US and around the world.", ruling: 1932 },
  { ein: "04-2103594", name: "Partners in Health", city: "Boston", state: "MA", zip: "02199", nteeCode: "E86", nteeCategory: "Health Care", mission: "Provides a preferential option for the poor in health care.", ruling: 1987 },
  { ein: "52-1693387", name: "World Wildlife Fund", city: "Washington", state: "DC", zip: "20037", nteeCode: "C30", nteeCategory: "Environment", mission: "Conserves nature and reduces the most pressing threats to biodiversity.", ruling: 1961 },
  { ein: "94-2703833", name: "Silicon Valley Community Foundation", city: "Mountain View", state: "CA", zip: "94043", nteeCode: "T31", nteeCategory: "Philanthropy & Voluntarism", mission: "Mobilizes philanthropic capital to create a more just and equitable world.", ruling: 1993 },
  { ein: "13-3262114", name: "Robin Hood Foundation", city: "New York", state: "NY", zip: "10011", nteeCode: "T30", nteeCategory: "Philanthropy & Voluntarism", mission: "Fights poverty in New York City.", ruling: 1988 },
  { ein: "36-2423707", name: "Chicago Community Trust", city: "Chicago", state: "IL", zip: "60601", nteeCode: "T31", nteeCategory: "Philanthropy & Voluntarism", mission: "Connects donors to the most pressing needs in metropolitan Chicago.", ruling: 1915 },
  { ein: "58-1788494", name: "Atlanta Community Food Bank", city: "Atlanta", state: "GA", zip: "30310", nteeCode: "K31", nteeCategory: "Food, Agriculture & Nutrition", mission: "Works to end hunger in the 29-county metro Atlanta area.", ruling: 1979 },
  { ein: "82-2230781", name: "Khan Academy", city: "Mountain View", state: "CA", zip: "94041", nteeCode: "B60", nteeCategory: "Education", mission: "Provides a free, world-class education for anyone, anywhere.", ruling: 2007 },
  { ein: "04-3188271", name: "City Year Inc", city: "Boston", state: "MA", zip: "02210", nteeCode: "O50", nteeCategory: "Youth Development", mission: "Keeps students in school and on track to graduate.", ruling: 1988 },
];

function makeFilings(orgId: string, ein: string, base: { revenue: number; expenses: number; assets: number; growth: number }) {
  const years = [2020, 2021, 2022, 2023];
  return years.map((year, i) => {
    const g = Math.pow(1 + base.growth, i);
    const rev = Math.round(base.revenue * g);
    const exp = Math.round(base.expenses * g * 0.97);
    const programPct = 0.73 + (Math.random() * 0.08);
    const adminPct = 0.1;
    const frPct = 1 - programPct - adminPct;
    const assets = Math.round(base.assets * g);
    const liabilities = Math.round(assets * 0.22);
    const contribPct = 0.6;

    return {
      id: `fil_${ein.replace(/-/g,"")}_${year}`,
      organizationId: orgId,
      ein,
      taxYear: year,
      totalRevenue: rev,
      totalExpenses: exp,
      netIncome: rev - exp,
      totalContributions: Math.round(rev * contribPct),
      programServiceRevenue: Math.round(rev * 0.3),
      investmentIncome: Math.round(rev * 0.02),
      otherRevenue: Math.round(rev * 0.08),
      totalAssets: assets,
      totalLiabilities: liabilities,
      netAssets: assets - liabilities,
      programExpenses: Math.round(exp * programPct),
      adminExpenses: Math.round(exp * adminPct),
      fundraisingExpenses: Math.round(exp * frPct),
      executiveCompensation: Math.round(Math.min(rev * 0.003, 800_000)),
      employeeCount: Math.round(exp / 65_000),
      totalGrants: Math.round(rev * contribPct * 0.6),
    };
  });
}

const FINANCIALS: Record<string, { revenue: number; expenses: number; assets: number; growth: number }> = {
  "13-1837418": { revenue: 2_900_000_000, expenses: 2_800_000_000, assets: 1_200_000_000, growth: 0.03 },
  "13-1788491": { revenue: 440_000_000,   expenses: 420_000_000,   assets: 180_000_000,   growth: 0.07 },
  "53-0196605": { revenue: 290_000_000,   expenses: 260_000_000,   assets: 950_000_000,   growth: 0.04 },
  "94-1312655": { revenue: 72_000_000,    expenses: 68_000_000,    assets: 55_000_000,    growth: 0.06 },
  "23-7327691": { revenue: 3_500_000_000, expenses: 3_400_000_000, assets: 700_000_000,   growth: 0.08 },
  "13-5562162": { revenue: 670_000_000,   expenses: 640_000_000,   assets: 320_000_000,   growth: 0.05 },
  "04-2103594": { revenue: 520_000_000,   expenses: 490_000_000,   assets: 210_000_000,   growth: 0.09 },
  "52-1693387": { revenue: 310_000_000,   expenses: 285_000_000,   assets: 480_000_000,   growth: 0.04 },
  "94-2703833": { revenue: 1_100_000_000, expenses: 900_000_000,   assets: 8_200_000_000, growth: 0.12 },
  "13-3262114": { revenue: 195_000_000,   expenses: 175_000_000,   assets: 230_000_000,   growth: 0.06 },
  "36-2423707": { revenue: 650_000_000,   expenses: 580_000_000,   assets: 4_100_000_000, growth: 0.07 },
  "58-1788494": { revenue: 89_000_000,    expenses: 82_000_000,    assets: 42_000_000,    growth: 0.06 },
  "82-2230781": { revenue: 58_000_000,    expenses: 54_000_000,    assets: 34_000_000,    growth: 0.15 },
  "04-3188271": { revenue: 145_000_000,   expenses: 138_000_000,   assets: 58_000_000,    growth: 0.04 },
};

async function main() {
  console.log("Seeding database...");

  for (const org of ORGS) {
    const created = await prisma.organization.upsert({
      where: { ein: org.ein },
      update: {},
      create: {
        ein: org.ein,
        name: org.name,
        city: org.city,
        state: org.state,
        zip: org.zip,
        nteeCode: org.nteeCode,
        nteeCategory: org.nteeCategory,
        mission: org.mission,
        ruling: org.ruling,
        subsection: "501(c)(3)",
      },
    });

    const fin = FINANCIALS[org.ein];
    if (!fin) continue;

    const filings = makeFilings(created.id, org.ein, fin);

    for (const f of filings) {
      await prisma.filing.upsert({
        where: { ein_taxYear: { ein: f.ein, taxYear: f.taxYear } },
        update: {},
        create: f,
      });
    }

    const metrics = computeAllMetrics(org.ein, created.id, filings);
    for (const m of metrics) {
      await prisma.derivedMetrics.upsert({
        where: { ein_taxYear: { ein: m.ein, taxYear: m.taxYear } },
        update: {},
        create: {
          ein: m.ein,
          organizationId: m.organizationId,
          taxYear: m.taxYear,
          programExpenseRatio: m.programExpenseRatio ?? undefined,
          adminRatio: m.adminRatio ?? undefined,
          fundraisingRatio: m.fundraisingRatio ?? undefined,
          revenueGrowthYoY: m.revenueGrowthYoY ?? undefined,
          assetGrowthYoY: m.assetGrowthYoY ?? undefined,
          netMargin: m.netMargin ?? undefined,
          liquidityRatio: m.liquidityRatio ?? undefined,
        },
      });
    }

    console.log(`  Seeded: ${org.name}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
