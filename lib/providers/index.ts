import type { NonprofitDataProvider } from "./types";
import { MockProvider } from "./mock-provider";

// Provider selection:
//  1. NEXT_PUBLIC_DATA_PROVIDER env var ("mock" | "propublica" | "prisma")
//  2. Auto-detect: DATABASE_URL set → prisma; otherwise → propublica (real data)
function createProvider(): NonprofitDataProvider {
  const explicit = process.env.NEXT_PUBLIC_DATA_PROVIDER;

  if (explicit === "prisma" || (!explicit && process.env.DATABASE_URL)) {
    const { PrismaProvider } = require("./prisma-provider");
    return new PrismaProvider();
  }

  if (explicit === "mock") {
    return new MockProvider();
  }

  // Default: ProPublica — real data, no API key, no DB required
  const { ProPublicaProvider } = require("./propublica-provider");
  return new ProPublicaProvider();
}

export const dataProvider: NonprofitDataProvider = createProvider();
export type { NonprofitDataProvider } from "./types";
