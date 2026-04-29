import { NextResponse } from "next/server";
import { fetchScheduleJ } from "@/lib/irs/fetch-schedule-j";

export const dynamic = "force-dynamic";

interface PPFiling {
  tax_prd_yr: string | number;
  object_id?: string;
  pdf_url?: string;
}

// Extract IRS S3 object_id from ProPublica's pdf_url when the field is missing.
// pdf_url path looks like: IRS/954016653_202306_990_2024042322369843.pdf
// The last numeric segment is the IRS object_id.
function objectIdFromPdfUrl(pdfUrl: string): string | null {
  try {
    const decoded = decodeURIComponent(new URL(pdfUrl).searchParams.get("path") ?? "");
    const filename = decoded.split("/").pop()?.replace(".pdf", "") ?? "";
    const segments = filename.split("_");
    // Object id is the last segment
    const candidate = segments[segments.length - 1];
    if (/^\d{10,}$/.test(candidate)) return candidate;
  } catch {}
  return null;
}

// Fallback: query IRS EFTS full-text search for the object_id by EIN + tax year
async function lookupObjectIdFromEfts(
  ein: string,
  taxYear: number
): Promise<string | null> {
  try {
    const start = `${taxYear}-01-01`;
    const end = `${taxYear + 2}-12-31`;
    const url = `https://efts.irs.gov/LATEST/search-index?q=%22${ein}%22&dateRange=custom&startDate=${start}&endDate=${end}&forms=990,990EZ,990PF`;
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { hits?: { hits?: { _id: string; _source?: { TaxPeriod?: string } }[] } };
    const hits = data?.hits?.hits ?? [];
    // Match the correct tax period (YYYYMM)
    const taxPeriodPrefix = String(taxYear);
    const match = hits.find((h) => h._source?.TaxPeriod?.startsWith(taxPeriodPrefix));
    return match?._id ?? hits[0]?._id ?? null;
  } catch {
    return null;
  }
}

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

  const data = (await res.json()) as { filings_with_data?: PPFiling[] };
  const filings = (data.filings_with_data ?? []).slice(0, 5);

  const results: { taxYear: number; objectId: string }[] = [];

  for (const f of filings) {
    const taxYear = parseInt(String(f.tax_prd_yr), 10);
    if (isNaN(taxYear)) continue;

    // 1. Use object_id directly if present
    if (f.object_id && /^\d+$/.test(f.object_id)) {
      results.push({ taxYear, objectId: f.object_id });
      continue;
    }

    // 2. Extract from pdf_url
    const fromPdf = f.pdf_url ? objectIdFromPdfUrl(f.pdf_url) : null;
    if (fromPdf) {
      results.push({ taxYear, objectId: fromPdf });
      continue;
    }

    // 3. Query IRS EFTS as last resort
    const fromEfts = await lookupObjectIdFromEfts(normalized, taxYear);
    if (fromEfts) {
      results.push({ taxYear, objectId: fromEfts });
    }
  }

  return results;
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

    const results = await Promise.all(
      filings.slice(0, 3).map((f) => fetchScheduleJ(f.objectId, f.taxYear))
    );

    const years = results
      .filter((r): r is NonNullable<typeof r> => r !== null && r.records.length > 0)
      .sort((a, b) => b.taxYear - a.taxYear);

    return NextResponse.json({ ein, years });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
