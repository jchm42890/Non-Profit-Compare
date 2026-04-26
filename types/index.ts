// Core domain types used throughout the app

export interface Organization {
  id: string;
  ein: string;
  name: string;
  city: string;
  state: string;
  zip?: string;
  nteeCode: string;
  nteeCategory: string;
  mission?: string;
  website?: string;
  ruling?: number;
  subsection?: string;
}

export interface Filing {
  id: string;
  organizationId: string;
  ein: string;
  taxYear: number;
  filedAt?: string;

  totalRevenue?: number;
  totalExpenses?: number;
  netIncome?: number;
  totalContributions?: number;
  programServiceRevenue?: number;
  investmentIncome?: number;
  otherRevenue?: number;

  totalAssets?: number;
  totalLiabilities?: number;
  netAssets?: number;

  programExpenses?: number;
  adminExpenses?: number;
  fundraisingExpenses?: number;

  executiveCompensation?: number;
  employeeCount?: number;
  totalGrants?: number;
}

export interface DerivedMetrics {
  id: string;
  organizationId: string;
  ein: string;
  taxYear: number;

  programExpenseRatio?: number;
  adminRatio?: number;
  fundraisingRatio?: number;
  revenueGrowthYoY?: number;
  assetGrowthYoY?: number;
  netMargin?: number;
  liquidityRatio?: number;
}

export interface OrganizationWithFilings extends Organization {
  filings: Filing[];
  derivedMetrics: DerivedMetrics[];
  latestFiling?: Filing;
  latestMetrics?: DerivedMetrics;
}

export interface SearchFilters {
  query?: string;
  state?: string;
  city?: string;
  nteeCode?: string;
  nteeCategory?: string;
  minRevenue?: number;
  maxRevenue?: number;
}

export interface SearchResult {
  organizations: Organization[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SimilarOrganization extends Organization {
  similarityTags: SimilarityTag[];
  latestFiling?: Filing;
}

export type SimilarityTag =
  | "same-category"
  | "same-state"
  | "same-city"
  | "similar-size"
  | "same-ntee";

export interface CompareEntry {
  ein: string;
  name: string;
  city: string;
  state: string;
  nteeCategory: string;
}

// NTEE category map (top-level)
export const NTEE_CATEGORIES: Record<string, string> = {
  A: "Arts, Culture & Humanities",
  B: "Education",
  C: "Environment",
  D: "Animal-Related",
  E: "Health Care",
  F: "Mental Health",
  G: "Disease, Disorders & Medical Research",
  H: "Medical Research",
  I: "Crime & Legal-Related",
  J: "Employment",
  K: "Food, Agriculture & Nutrition",
  L: "Housing & Shelter",
  M: "Public Safety",
  N: "Recreation & Sports",
  O: "Youth Development",
  P: "Human Services",
  Q: "International, Foreign Affairs",
  R: "Civil Rights & Advocacy",
  S: "Community Improvement",
  T: "Philanthropy & Voluntarism",
  U: "Science & Technology",
  V: "Social Science",
  W: "Public & Societal Benefit",
  X: "Religion",
  Y: "Mutual & Membership Benefit",
  Z: "Unknown",
};
