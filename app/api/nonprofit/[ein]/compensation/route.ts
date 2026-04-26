import { NextResponse } from "next/server";
import { fetchScheduleJ } from "@/lib/irs/fetch-schedule-j";

export const dynamic = "force-dynamic";

// ProPublica filing detail includes object_id for each year's 990 XML
async function getFilingObjectIds(
  ein: string
): Promise<{ taxYear: number; objectId: string }[]> {
  const normalized = ein.replace(/-/g, "");
  const base =
    process.env.PROPUBLICA_API_BASE ??
    "https://projects.propublica.org/nonprofits/api/v2";

  const res = await fetch(`${base}/organizations/${normalized}.json`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    filings_with_data?: { tax_prd_yr: string; object_id: string }[];
  };

  return (data.filings_with_data ?? [])
    .filter((f) => f.object_id)
    .slice(0, 5) // latest 5 years
    .map((f) => ({
      taxYear: parseInt(f.tax_prd_yr, 10),
      objectId: f.object_id,
    }));
}

export async function GET(
  _req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;

  try {
    const filings = await getFilingObjectIds(ein);

    if (!filings.length) {
      return NextResponse.json({ ein, years: [] });
    }

    // Fetch Schedule J for each year in parallel (capped at 3)
    const results = await Promise.all(
      filings.slice(0, 3).map((f) => fetchScheduleJ(f.objectId, f.taxYear))
    );

    const years = results
      .filter((r): r is NonNullable<typeof r> => r !== null && r.records.length > 0)
      .sort((a, b) => b.taxYear - a.taxYear);

    return NextResponse.json({ ein, years });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
