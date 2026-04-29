import { NextResponse } from "next/server";
import { fetchScheduleJ, fetchScheduleJFromXmlUrl, type ScheduleJResult } from "@/lib/irs/fetch-schedule-j";
import { extractOfficersFromPdf } from "@/lib/irs/parse-990-pdf";

export const dynamic = "force-dynamic";

interface PPFiling {
  tax_prd_yr: string | number;
  object_id?: string;
  pdf_url?: string;
}

function xmlUrlFromPdf(pdfUrl: string): string | null {
  try {
    const u = new URL(pdfUrl);
    const path = decodeURIComponent(u.searchParams.get("path") ?? "");
    if (!path.endsWith(".pdf")) return null;
    u.searchParams.set("path", path.replace(/\.pdf$/, ".xml"));
    return u.toString();
  } catch {
    return null;
  }
}

// Only use the ProPublica-provided object_id (already the IRS key).
// The last path segment from pdf_url is ProPublica's internal ID, not the IRS
// objectId — do NOT use it for S3 lookups.
function extractObjectId(f: PPFiling): string | null {
  if (f.object_id && /^\d{14,}$/.test(f.object_id)) return f.object_id;
  return null;
}

async function getPPFilings(ein: string): Promise<PPFiling[]> {
  const normalized = ein.replace(/-/g, "");
  const base = process.env.PROPUBLICA_API_BASE ?? "https://projects.propublica.org/nonprofits/api/v2";
  const res = await fetch(`${base}/organizations/${normalized}.json`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { filings_with_data?: PPFiling[] };
  return data.filings_with_data ?? [];
}

// IRS EFTS full-text search returns the real IRS objectId for any e-filed 990.
// Returns the objectId string if found, or null on any failure.
async function findObjectIdViaEFTS(ein: string, taxYear: number): Promise<string | null> {
  try {
    const normalized = ein.replace(/-/g, "");
    // Tax period ending date is typically June 30 for fiscal-year orgs, Dec 31 for calendar-year
    const url =
      `https://efts.irs.gov/LATEST/search-engines/irs_990_search_engine_data/search` +
      `?q=&ein=${normalized}&dateRange=custom` +
      `&startDate=${taxYear}-01-01&endDate=${taxYear + 1}-06-30`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; nonprofit-research/1.0)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const hits = ((data.hits as Record<string, unknown>)?.hits as unknown[]) ?? [];
    for (const h of hits) {
      const hit = h as Record<string, unknown>;
      const src = hit._source as Record<string, unknown> | undefined;
      const id = String(src?.ObjectId ?? src?.object_id ?? hit._id ?? "");
      if (/^\d{14,}$/.test(id)) return id;
    }
  } catch {
    // EFTS unreachable or timed out — proceed to next strategy
  }
  return null;
}

interface StrategyLog {
  taxYear: number;
  s0_efts: string;
  s1_s3_xml: string;
  s2_pp_xml: string;
  s2_url: string | null;
  s3_pdf: string;
  result: "found" | "none";
  recordCount: number;
}

async function resolveScheduleJ(
  f: PPFiling,
  ein: string,
  debug: boolean
): Promise<{ result: ScheduleJResult | null; log: StrategyLog }> {
  const taxYear = parseInt(String(f.tax_prd_yr), 10);
  const log: StrategyLog = {
    taxYear,
    s0_efts: "skipped",
    s1_s3_xml: "skipped",
    s2_pp_xml: "skipped",
    s2_url: null,
    s3_pdf: "skipped",
    result: "none",
    recordCount: 0,
  };

  let objectId = extractObjectId(f);

  // Strategy 0: IRS EFTS lookup to find objectId when ProPublica doesn't provide it
  if (!objectId) {
    const eftsId = await findObjectIdViaEFTS(ein, taxYear);
    if (eftsId) {
      objectId = eftsId;
      log.s0_efts = `found: ${eftsId}`;
    } else {
      log.s0_efts = "not found";
    }
  } else {
    log.s0_efts = `skipped (have objectId: ${objectId})`;
  }

  // Strategy 1: IRS S3 XML (requires a real IRS objectId)
  if (objectId) {
    const r = await fetchScheduleJ(objectId, taxYear);
    log.s1_s3_xml = r ? `ok (${r.records.length} records)` : "404/empty";
    if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
  } else {
    log.s1_s3_xml = "no objectId";
  }

  // Strategy 2: Try fetching the ProPublica XML URL with redirect capture
  // ProPublica proxies to an S3 URL; with redirect:manual we can see the real destination
  if (f.pdf_url) {
    const xmlUrl = xmlUrlFromPdf(f.pdf_url);
    log.s2_url = xmlUrl ?? f.pdf_url;
    const targetUrl = xmlUrl ?? f.pdf_url;
    try {
      const headRes = await fetch(targetUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/xml, text/xml, */*",
          "Referer": "https://projects.propublica.org/nonprofits/",
        },
      });
      const location = headRes.headers.get("location");
      log.s2_pp_xml = `HTTP ${headRes.status}${location ? ` → ${location.slice(0, 80)}` : ""}`;
      if (location && (location.includes("s3.amazonaws.com") || location.includes("amazonaws.com"))) {
        const r = await fetchScheduleJFromXmlUrl(location, taxYear);
        log.s2_pp_xml += r ? ` parsed (${r.records.length} records)` : " → 0 parsed";
        if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
      }
    } catch (e) {
      log.s2_pp_xml = `error: ${String(e).slice(0, 80)}`;
    }
  }

  // Strategy 3: PDF text parsing (only viable if pdf_url is not a ProPublica proxy)
  if (f.pdf_url && !f.pdf_url.includes("projects.propublica.org")) {
    try {
      const records = await extractOfficersFromPdf(f.pdf_url);
      log.s3_pdf = `parsed (${records.length} records)`;
      if (records.length > 0) {
        const r: ScheduleJResult = { taxYear, objectId: "pdf", records };
        log.result = "found"; log.recordCount = records.length;
        return { result: r, log };
      }
    } catch (e) {
      log.s3_pdf = `error: ${String(e).slice(0, 120)}`;
    }
  } else if (f.pdf_url) {
    log.s3_pdf = "skipped (ProPublica proxy)";
  }

  return { result: null, log };
}

export async function GET(
  req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;
  const debug = new URL(req.url).searchParams.has("debug");

  try {
    const filings = await getPPFilings(ein);
    if (!filings.length) return NextResponse.json({ ein, years: [] });

    // Try up to 6 filings — older ones (2019-2021) have IRS objectIds directly from ProPublica
    const outcomes = await Promise.all(
      filings.slice(0, 6).map((f) => resolveScheduleJ(f, ein, debug))
    );

    const years = outcomes
      .map((o) => o.result)
      .filter((r): r is ScheduleJResult => r !== null && r.records.length > 0)
      .sort((a, b) => b.taxYear - a.taxYear);

    if (debug) {
      return NextResponse.json({
        ein,
        years,
        debugLogs: outcomes.map((o) => o.log),
      });
    }

    return NextResponse.json({ ein, years });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
