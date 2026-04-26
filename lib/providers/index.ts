import type { NonprofitDataProvider } from "./types";
import { MockProvider } from "./mock-provider";

// Provider selection order:
//  1. NEXT_PUBLIC_DATA_PROVIDER env var ("mock" | "prisma" | "propublica")
//  2. Auto-detect: if DATABASE_URL is set, use prisma; otherwise mock
function createProvider(): NonprofitDataProvider {
  const explicit = process.env.NEXT_PUBLIC_DATA_PROVIDER;

  if (explicit === "prisma" || (!explicit && process.env.DATABASE_URL)) {
    // Dynamic import keeps Prisma out of the client bundle
    const { PrismaProvider } = require("./prisma-provider");
    return new PrismaProvider();
  }

  if (explicit === "propublica") {
    // Swap in a real ProPublicaProvider here when ready:
    // const { ProPublicaProvider } = require("./propublica-provider");
    // return new ProPublicaProvider();
    console.warn("ProPublica provider not yet implemented; falling back to mock");
  }

  return new MockProvider();
}

export const dataProvider: NonprofitDataProvider = createProvider();
export type { NonprofitDataProvider } from "./types";
