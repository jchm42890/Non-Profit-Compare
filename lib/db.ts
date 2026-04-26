import { PrismaClient } from "@prisma/client";

// In serverless (Vercel) each function invocation can spin up a new module
// instance, creating too many DB connections. This singleton reuses the client
// across hot-reloads in dev and across warm lambda invocations in production.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
