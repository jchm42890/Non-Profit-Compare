# Nonprofit Compare

A production-quality web app for comparing US nonprofit IRS Form 990 financial data side by side.

## Overview

Nonprofit Compare lets you:

- **Search** thousands of nonprofit organizations by name, EIN, city, or state
- **Profile** any nonprofit with KPI cards, multi-year trend charts, filing history, and derived efficiency ratios
- **Discover** similar organizations (by NTEE category, geography, or size) and nearby nonprofits
- **Compare** up to 6 nonprofits simultaneously in a structured table + 4 interactive charts

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Validation | Zod |
| State | Zustand (localStorage-persisted) |
| Database | PostgreSQL + Prisma ORM |

## Quick Start

### 1. Clone and install

```bash
git clone git@github.com:jchm42890/Non-Profit-Compare.git
cd Non-Profit-Compare
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required for database features (optional — mock provider works without it)
DATABASE_URL="postgresql://user:password@localhost:5432/nonprofit_compare"

# "mock" runs with no external dependencies (default)
NEXT_PUBLIC_DATA_PROVIDER="mock"
```

### 3. Run locally (mock data — no DB required)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run with PostgreSQL (optional)

```bash
# Push schema to your database
npm run db:push

# Seed with 14 realistic nonprofits
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `NEXT_PUBLIC_DATA_PROVIDER` | `mock` | Which data provider to use: `mock` \| `propublica` |

## How the Data Provider Works

The app uses a provider abstraction in `lib/providers/`:

```
lib/providers/
├── types.ts          # NonprofitDataProvider interface
├── mock-provider.ts  # Fully functional mock with 14 orgs + multi-year filings
└── index.ts          # Factory that selects provider from env var
```

### NonprofitDataProvider interface

```typescript
interface NonprofitDataProvider {
  searchOrganizations(query, filters?, page?, pageSize?): Promise<SearchResult>
  getOrganizationByEin(ein): Promise<OrganizationWithFilings | null>
  getOrganizationFilings(ein): Promise<Filing[]>
  getOrganizationMetrics(ein): Promise<DerivedMetrics[]>
  getSimilarOrganizations(ein, strategy?, limit?): Promise<SimilarOrganization[]>
  getLocalOrganizations(location, filters?, limit?): Promise<Organization[]>
}
```

### Switching to the ProPublica API

1. Create `lib/providers/propublica-provider.ts` implementing `NonprofitDataProvider`
2. Set `NEXT_PUBLIC_DATA_PROVIDER=propublica` in `.env`
3. Update the factory in `lib/providers/index.ts`

No changes needed to any page or component — they all consume the provider interface.

## Compare Feature

The Compare tab (`/compare`) allows side-by-side analysis:

- **Add to Compare** buttons appear on every nonprofit card and profile page
- Selections are **persisted in localStorage** via Zustand — survive page reloads
- **Up to 6 nonprofits** can be compared at once
- The badge in the header shows the current count

### Metrics in the comparison table

| Metric | Description |
|---|---|
| Program Expense Ratio | % of expenses directed to mission |
| Admin Ratio | % of expenses for overhead |
| Fundraising Ratio | % of expenses on fundraising |
| Revenue Growth YoY | Year-over-year revenue change |
| Asset Growth YoY | Year-over-year asset change |
| Net Margin | Net income / revenue |
| Months of Reserves | Net assets / monthly expenses |

### Derived metrics assumptions

- **Growth rates** use `(current - prior) / |prior|` — absolute value of prior prevents sign-flip artifacts
- **Program ratio** uses `programExpenses / totalExpenses` (not revenue)
- **Months of reserves** uses calendar-year-end net assets divided by total annual expenses / 12
- All metrics show `N/A` when data is missing rather than computing with 0

## Project Structure

```
nonprofit-compare/
├── app/
│   ├── layout.tsx              # Root layout with sticky header
│   ├── page.tsx                # Landing page
│   ├── search/page.tsx         # Search results
│   ├── nonprofit/[ein]/page.tsx # Organization profile
│   ├── compare/page.tsx        # Side-by-side comparison
│   └── api/
│       ├── search/route.ts
│       └── nonprofit/[ein]/
│           ├── route.ts
│           ├── similar/route.ts
│           └── local/route.ts
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── Header.tsx
│   ├── SearchBar.tsx           # Autocomplete search
│   ├── NonprofitCard.tsx
│   ├── KPIGrid.tsx             # 12-metric KPI cards
│   ├── TrendChart.tsx          # Line + stacked bar charts
│   ├── SimilarNonprofitsPanel.tsx
│   ├── LocalNonprofitsPanel.tsx
│   ├── AddToCompareButton.tsx  # Stateful add/remove button
│   ├── CompareBadge.tsx        # Sticky header badge
│   ├── CompareTable.tsx        # 22-row comparison table
│   ├── CompareCharts.tsx       # 4 comparison charts
│   ├── EmptyState.tsx
│   └── MetricTooltip.tsx
├── lib/
│   ├── providers/              # Data provider interface + mock
│   ├── metrics/                # Derived metrics computation
│   ├── compare/                # Zustand compare store
│   └── utils/                  # format.ts, cn.ts
├── prisma/
│   ├── schema.prisma           # Organization, Filing, DerivedMetrics
│   └── seed.ts                 # 14 nonprofits across 8 categories
└── types/index.ts              # Shared TypeScript types
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:seed` | Seed database with 14 nonprofits |
| `npm run db:studio` | Open Prisma Studio |

## Seed Data

The mock provider and seed script include 14 organizations across:

- **Categories**: Human Services, Health Care, Food & Nutrition, Environment, Education, Youth Development, Philanthropy, Science
- **States**: DC, NY, CA, IL, CT, MA, GA
- **Revenue range**: $58M — $3.5B
- **Years**: 2020–2023 with computed derived metrics
