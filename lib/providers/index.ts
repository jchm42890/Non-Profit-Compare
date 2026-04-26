import type { NonprofitDataProvider } from "./types";
import type { SearchResult } from "@/types";
import { MockProvider } from "./mock-provider";

// Server-side provider selection — checked at runtime (not baked at build time).
// Set DATA_PROVIDER in Vercel env vars:
//   "propublica" → ProPublica API, 1.8M+ real nonprofits, no DB needed (default)
//   "prisma"     → PostgreSQL via Prisma (requires DATABASE_URL + seeded DB)
//   "mock"       → 14 built-in orgs, works offline
//
// NEXT_PUBLIC_DATA_PROVIDER is kept for legacy/client display only.
function resolveProviderName(): string {
  return (
    process.env.DATA_PROVIDER ??
    process.env.NEXT_PUBLIC_DATA_PROVIDER ??
    "propublica"
  );
}

function buildPrismaProvider(): NonprofitDataProvider | null {
  try {
    const { PrismaProvider } = require("./prisma-provider");
    return new PrismaProvider();
  } catch {
    return null;
  }
}

function buildProPublicaProvider(): NonprofitDataProvider {
  const { ProPublicaProvider } = require("./propublica-provider");
  return new ProPublicaProvider();
}

// Wraps a primary provider so that:
//  - any thrown error falls back to ProPublica
//  - empty search results (when a query was given) also fall back to ProPublica
function withProPublicaFallback(
  primary: NonprofitDataProvider
): NonprofitDataProvider {
  const fallback = buildProPublicaProvider();

  return new Proxy(primary, {
    get(target, prop: string) {
      const orig = (target as unknown as Record<string, unknown>)[prop];
      if (typeof orig !== "function") return orig;

      return async (...args: unknown[]) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (orig as any).apply(target, args);

          // For searches: fall back when DB returned nothing for a non-empty query
          if (
            prop === "searchOrganizations" &&
            (result as SearchResult).organizations?.length === 0 &&
            args[0] &&
            String(args[0]).trim().length > 0
          ) {
            console.warn(
              "[provider] Prisma returned 0 results — trying ProPublica"
            );
            const fb = (fallback as unknown as Record<string, unknown>)[prop];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (fb as any).apply(fallback, args);
          }

          return result;
        } catch (err) {
          console.error(`[provider] ${prop} failed on Prisma:`, err);
          const fb = (fallback as unknown as Record<string, unknown>)[prop];
          if (typeof fb === "function") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (fb as any).apply(fallback, args);
          }
          throw err;
        }
      };
    },
  });
}

function createProvider(): NonprofitDataProvider {
  const name = resolveProviderName();

  if (name === "mock") {
    return new MockProvider();
  }

  if (name === "prisma") {
    const prisma = buildPrismaProvider();
    if (prisma) return withProPublicaFallback(prisma);
    console.warn("[provider] Prisma failed to load — falling back to ProPublica");
  }

  if (name === "propublica" || name === "prisma") {
    return buildProPublicaProvider();
  }

  // Unknown value — default to ProPublica
  console.warn(`[provider] Unknown DATA_PROVIDER "${name}" — using ProPublica`);
  return buildProPublicaProvider();
}

export const dataProvider: NonprofitDataProvider = createProvider();
export type { NonprofitDataProvider } from "./types";
