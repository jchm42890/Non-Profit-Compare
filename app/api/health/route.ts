import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const providerName =
    process.env.DATA_PROVIDER ??
    process.env.NEXT_PUBLIC_DATA_PROVIDER ??
    "propublica (default)";

  let searchTest: unknown = null;
  let error: string | null = null;

  try {
    const { dataProvider } = await import("@/lib/providers");
    const result = await dataProvider.searchOrganizations("food bank", {}, 1, 3);
    searchTest = {
      count: result.organizations.length,
      first: result.organizations[0]?.name ?? null,
    };
  } catch (e) {
    error = String(e);
  }

  return NextResponse.json({
    ok: true,
    provider: providerName,
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "not set",
    DIRECT_URL: process.env.DIRECT_URL ? "set" : "not set",
    searchTest,
    error,
  });
}
