import type { NonprofitDataProvider } from "./types";
import { MockProvider } from "./mock-provider";

// Provider selection:
//  NEXT_PUBLIC_DATA_PROVIDER = "mock" | "propublica" | "prisma"
//
//  Default (no env var set):
//    - DATABASE_URL present → try Prisma, fall back to ProPublica on error
//    - no DATABASE_URL       → ProPublica (real data, no DB needed)
//
//  "propublica" → ProPublica API (1.8M+ real nonprofits, no key required)
//  "prisma"     → PostgreSQL via Prisma (requires DATABASE_URL + migrated DB)
//  "mock"       → in-memory seed data (14 orgs, works offline)

function createProvider(): NonprofitDataProvider {
  const explicit = process.env.NEXT_PUBLIC_DATA_PROVIDER;

  if (explicit === "mock") {
    return new MockProvider();
  }

  if (explicit === "prisma" || (!explicit && process.env.DATABASE_URL)) {
    try {
      const { PrismaProvider } = require("./prisma-provider");
      return new PrismaProvider();
    } catch {
      console.warn(
        "[provider] Prisma failed to load — falling back to ProPublica"
      );
    }
  }

  // Default: ProPublica — real data, no API key, no DB required
  const { ProPublicaProvider } = require("./propublica-provider");
  return new ProPublicaProvider();
}

// Wrap every provider call so a runtime DB error gracefully falls back
// to ProPublica rather than returning a 500 to the user.
function withFallback(primary: NonprofitDataProvider): NonprofitDataProvider {
  const { ProPublicaProvider } = require("./propublica-provider");
  const fallback: NonprofitDataProvider = new ProPublicaProvider();

  return new Proxy(primary, {
    get(target, prop) {
      const orig = (target as unknown as Record<string, unknown>)[prop as string];
      if (typeof orig !== "function") return orig;
      return async (...args: unknown[]) => {
        try {
          return await (orig as (...a: unknown[]) => Promise<unknown>).apply(
            target,
            args
          );
        } catch (err) {
          console.error(
            `[provider] ${String(prop)} failed on primary provider:`,
            err
          );
          const fb = (fallback as unknown as Record<string, unknown>)[prop as string];
          if (typeof fb === "function") {
            return (fb as (...a: unknown[]) => Promise<unknown>).apply(
              fallback,
              args
            );
          }
          throw err;
        }
      };
    },
  });
}

const primary = createProvider();

// Only wrap with fallback when Prisma is the primary (so errors fall back to real data)
export const dataProvider: NonprofitDataProvider =
  process.env.NEXT_PUBLIC_DATA_PROVIDER === "prisma" ||
  (!process.env.NEXT_PUBLIC_DATA_PROVIDER && process.env.DATABASE_URL)
    ? withFallback(primary)
    : primary;

export type { NonprofitDataProvider } from "./types";
