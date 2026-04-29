import { NextResponse } from "next/server";
import { fetchScheduleJ, type ScheduleJResult } from "@/lib/irs/fetch-schedule-j";
import { extractOfficersFromPdf } from "@/lib/irs/parse-990-pdf";

export const dynamic = "force-dynamic";

interface PPFiling {
  tax_prd_yr: string | number;
  object_id?: string;
  pdf_url?: string;
}

// Swap .pdf → .xml in ProPublica's download-filing URL.
// ProPublica stores both PDF and XML for e-filed returns.
function xmlUrlFromPdf(pdfUrl: string): string | null {
  try {
    const u = new URL(pdfUrl);
    const path = decodeURIComponent(u.searchParams.get("path") ?? "");
    if (!path.endsWith(".pdf")) return null;
    const xmlPath = path.replace(/\.pdf$/, ".xml");
    u.searchParams.set("path", xmlPath);
    return u.toString();
  } catch {
    return null;
  }
}

function extractObjectId(f: PPFiling): string | null {
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
  const data = (await res.json()) as { filings_with_data?: PPFiling[] };
  return data.filings_with_data ?? [];
}

async function resolveScheduleJ(f: PPFiling): Promise<ScheduleJResult | null> {
  const taxYear = parseInt(String(f.tax_prd_yr), 10);
  if (isNaN(taxYear)) return null;

  // Strategy 1: IRS S3 XML (works for filings ~2+ years old)
  const objectId = extractObjectId(f);
  if (objectId) {
    const result = await fetchScheduleJ(objectId, taxYear);
    if (result) return result;
  }

  // Strategy 2: ProPublica hosts the XML alongside the PDF
  if (f.pdf_url) {
    const xmlUrl = xmlUrlFromPdf(f.pdf_url);
    if (xmlUrl) {
      const { fetchScheduleJFromXmlUrl } = await import("@/lib/irs/fetch-schedule-j");
      const result = await fetchScheduleJFromXmlUrl(xmlUrl, taxYear);
      if (result) return result;
    }
  }

  // Strategy 3: Parse the PDF itself
  if (f.pdf_url) {
    try {
      const records = await extractOfficersFromPdf(f.pdf_url);
      if (records.length > 0) {
        return { taxYear, objectId: "pdf", records };
      }
    } catch {
      // PDF parsing failed — not fatal
    }
  }

  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;

  try {
    const filings = await getPPFilings(ein);
    if (!filings.length) return NextResponse.json({ ein, years: [] });

    // Try all strategies for the 3 most recent filings in parallel
    const results = await Promise.all(filings.slice(0, 3).map(resolveScheduleJ));

    const years = results
      .filter((r): r is ScheduleJResult => r !== null && r.records.length > 0)
      .sort((a, b) => b.taxYear - a.taxYear);

    return NextResponse.json({ ein, years });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
