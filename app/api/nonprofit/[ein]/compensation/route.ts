import { NextResponse } from "next/server";
import { fetchScheduleJ, fetchScheduleJFromXmlUrl, type ScheduleJResult } from "@/lib/irs/fetch-schedule-j";
import { extractOfficersFromPdf } from "@/lib/irs/parse-990-pdf";

export const dynamic = "force-dynamic";

interface PPFiling {
  tax_prd_yr: string | number;
  object_id?: string;
  pdf_url?: string;
}

interface EFTSResult {
  objectId: string | null;
  detail: string;
}

// IRS EFTS full-text search — returns the real IRS objectId plus a detail string
// so callers can log exactly what happened.
async function findObjectIdViaEFTS(ein: string, taxYear: number): Promise<EFTSResult> {
  const normalized = ein.replace(/-/g, "");

  // Try two queries: broad (no date filter), then year-scoped
  const urls = [
    // Broad: all filings for this EIN
    `https://efts.irs.gov/LATEST/search-engines/irs_990_search_engine_data/search?q=&ein=${normalized}`,
    // Year-scoped
    `https://efts.irs.gov/LATEST/search-engines/irs_990_search_engine_data/search?q=&ein=${normalized}&dateRange=custom&startDate=${taxYear - 1}-01-01&endDate=${taxYear + 1}-12-31`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; nonprofit-research/1.0)",
          "Accept": "application/json",
        },
      });
      if (!res.ok) return { objectId: null, detail: `HTTP ${res.status}` };

      let data: Record<string, unknown>;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch (e) {
        return { objectId: null, detail: `bad JSON: ${String(e).slice(0, 60)}` };
      }

      const hitsWrapper = data.hits as Record<string, unknown> | undefined;
      const total = (hitsWrapper?.total as Record<string, unknown>)?.value ?? hitsWrapper?.total ?? 0;
      const hits = (hitsWrapper?.hits as unknown[]) ?? [];

      if (!hits.length) {
        return { objectId: null, detail: `0 hits (total=${total})` };
      }

      for (const h of hits) {
        const hit = h as Record<string, unknown>;
        const src = (hit._source as Record<string, unknown>) ?? {};
        const id = String(src.ObjectId ?? src.object_id ?? hit._id ?? "");
        if (/^\d{14,}$/.test(id)) {
          return { objectId: id, detail: `hit _id=${hit._id} src.TaxPeriod=${src.TaxPeriod}` };
        }
      }

      // Hits exist but no valid objectId — log keys so we can fix field name
      const firstSrc = ((hits[0] as Record<string, unknown>)._source as Record<string, unknown>) ?? {};
      return { objectId: null, detail: `${hits.length} hits no ID; keys=${Object.keys(firstSrc).slice(0, 8).join(",")}` };

    } catch (e) {
      const msg = String(e);
      if (msg.includes("TimeoutError") || msg.includes("AbortError")) {
        return { objectId: null, detail: "timeout (8s)" };
      }
      return { objectId: null, detail: `fetch error: ${msg.slice(0, 80)}` };
    }
  }
  return { objectId: null, detail: "no attempts made" };
}

// IRS apps.irs.gov Tax Exempt Organization Search — alternative objectId source
async function findObjectIdViaIRSTEOS(ein: string): Promise<EFTSResult> {
  try {
    const normalized = ein.replace(/-/g, "");
    const url = `https://apps.irs.gov/app/eos/api?action=getFilings&ein=${normalized}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return { objectId: null, detail: `TEOS HTTP ${res.status}` };
    const data = (await res.json()) as Record<string, unknown>;
    // Look for any field that resembles an objectId
    const filings = (data.filings as unknown[]) ?? (data.data as unknown[]) ?? [];
    for (const f of filings) {
      const filing = f as Record<string, unknown>;
      const id = String(filing.objectId ?? filing.ObjectId ?? filing.object_id ?? "");
      if (/^\d{14,}$/.test(id)) return { objectId: id, detail: `TEOS found: ${id}` };
    }
    return { objectId: null, detail: `TEOS 0 usable; keys=${Object.keys(data).slice(0, 6).join(",")}` };
  } catch (e) {
    return { objectId: null, detail: `TEOS error: ${String(e).slice(0, 60)}` };
  }
}

async function getPPFilings(ein: string): Promise<PPFiling[]> {
  const normalized = ein.replace(/-/g, "");
  const base = process.env.PROPUBLICA_API_BASE ?? "https://projects.propublica.org/nonprofits/api/v2";
  const res = await fetch(`${base}/organizations/${normalized}.json`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { filings_with_data?: PPFiling[] };
  return data.filings_with_data ?? [];
}

interface StrategyLog {
  taxYear: number;
  s0_efts: string;
  s0b_teos: string;
  s1_s3_xml: string;
  s2_pp_redirect: string;
  s2_url: string | null;
  s3_pdf: string;
  result: "found" | "none";
  recordCount: number;
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

async function resolveScheduleJ(
  f: PPFiling,
  ein: string,
  debug: boolean
): Promise<{ result: ScheduleJResult | null; log: StrategyLog }> {
  const taxYear = parseInt(String(f.tax_prd_yr), 10);
  const log: StrategyLog = {
    taxYear,
    s0_efts: "skipped",
    s0b_teos: "skipped",
    s1_s3_xml: "skipped",
    s2_pp_redirect: "skipped",
    s2_url: null,
    s3_pdf: "skipped",
    result: "none",
    recordCount: 0,
  };

  let objectId = (f.object_id && /^\d{14,}$/.test(f.object_id)) ? f.object_id : null;

  // Strategy 0: IRS EFTS to find real objectId
  if (!objectId) {
    const efts = await findObjectIdViaEFTS(ein, taxYear);
    log.s0_efts = efts.detail;
    if (efts.objectId) objectId = efts.objectId;
  } else {
    log.s0_efts = `skipped (pp has ${objectId})`;
  }

  // Strategy 0b: IRS TEOS fallback
  if (!objectId) {
    const teos = await findObjectIdViaIRSTEOS(ein);
    log.s0b_teos = teos.detail;
    if (teos.objectId) objectId = teos.objectId;
  } else {
    log.s0b_teos = "skipped";
  }

  // Strategy 1: IRS S3 XML
  if (objectId) {
    const r = await fetchScheduleJ(objectId, taxYear);
    log.s1_s3_xml = r ? `ok (${r.records.length} records)` : "404/empty";
    if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
  } else {
    log.s1_s3_xml = "no objectId";
  }

  // Strategy 2: Capture ProPublica redirect destination — if PP redirects to S3
  if (f.pdf_url) {
    const xmlUrl = xmlUrlFromPdf(f.pdf_url) ?? f.pdf_url;
    log.s2_url = xmlUrl;
    try {
      const res = await fetch(xmlUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/xml, text/xml, */*",
          "Referer": "https://projects.propublica.org/nonprofits/",
        },
      });
      const location = res.headers.get("location");
      log.s2_pp_redirect = `HTTP ${res.status}${location ? ` → ${location.slice(0, 100)}` : ""}`;

      if (location && location.includes("amazonaws.com")) {
        const r = await fetchScheduleJFromXmlUrl(location, taxYear);
        log.s2_pp_redirect += r ? ` parsed (${r.records.length})` : " → 0 parsed";
        if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
      }
    } catch (e) {
      log.s2_pp_redirect = `error: ${String(e).slice(0, 80)}`;
    }
  }

  // Strategy 3: PDF parsing (only for non-ProPublica URLs)
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

    // Check up to 6 filings — older ones may have IRS objectIds directly
    const outcomes = await Promise.all(
      filings.slice(0, 6).map((f) => resolveScheduleJ(f, ein, debug))
    );

    const years = outcomes
      .map((o) => o.result)
      .filter((r): r is ScheduleJResult => r !== null && r.records.length > 0)
      .sort((a, b) => b.taxYear - a.taxYear);

    if (debug) {
      return NextResponse.json({ ein, years, debugLogs: outcomes.map((o) => o.log) });
    }

    return NextResponse.json({ ein, years });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
