import { NextResponse } from "next/server";
import { fetchScheduleJ } from "@/lib/irs/fetch-schedule-j";

export const dynamic = "force-dynamic";

interface PPFiling {
  tax_prd_yr: string | number;
  object_id?: string;
  pdf_url?: string;
  compnsatncurrofcr?: number; // total officer comp from Part IX (always present)
}

function extractObjectId(f: PPFiling): string | null {
  // Direct object_id (present for filings in the IRS S3 dataset, typically pre-2023)
  if (f.object_id && /^\d{14,}$/.test(f.object_id)) return f.object_id;
  return null;
}

async function getPPFilings(ein: string): Promise<PPFiling[]> {
  const normalized = ein.replace(/-/g, "");
  const base =
    process.env.PROPUBLICA_API_BASE ??
    "https://projects.propublica.org/nonprofits/api/v2";
  const res = await fetch(`${base}/organizations/${normalized}.json`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json() as { filings_with_data?: PPFiling[] };
  return data.filings_with_data ?? [];
}

export async function GET(
  _req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;

  try {
    const filings = await getPPFilings(ein);

    // Aggregate summary rows (always available from ProPublica)
    const summary = filings
      .filter((f) => f.compnsatncurrofcr != null)
      .slice(0, 5)
      .map((f) => ({
        taxYear: parseInt(String(f.tax_prd_yr), 10),
        totalOfficerComp: f.compnsatncurrofcr ?? 0,
        pdfUrl: f.pdf_url ?? null,
        hasXml: false,
      }));

    // Try Schedule J XML for filings that have an object_id
    // (IRS S3 dataset typically covers filings through ~2 years ago)
    const xmlResults = await Promise.all(
      filings
        .slice(0, 5)
        .map(async (f) => {
          const objectId = extractObjectId(f);
          if (!objectId) return null;
          const taxYear = parseInt(String(f.tax_prd_yr), 10);
          return fetchScheduleJ(objectId, taxYear);
        })
    );

    // Merge XML results into summary
    for (const xmlResult of xmlResults) {
      if (!xmlResult || !xmlResult.records.length) continue;
      const row = summary.find((s) => s.taxYear === xmlResult.taxYear);
      if (row) row.hasXml = true;
    }

    const scheduleJYears = xmlResults
      .filter((r): r is NonNullable<typeof r> => r !== null && r.records.length > 0)
      .sort((a, b) => b.taxYear - a.taxYear);

    return NextResponse.json({
      ein,
      // Detailed Schedule J breakdown when XML is available
      years: scheduleJYears,
      // Aggregate totals for all years (always populated from ProPublica)
      summary,
      xmlAvailable: scheduleJYears.length > 0,
      note: scheduleJYears.length === 0
        ? "IRS 990 XML files for recent filings (typically within 1-2 years) are not yet published to the public dataset. Aggregate totals are shown from ProPublica. Click 'View PDF' to see full Schedule J."
        : null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
