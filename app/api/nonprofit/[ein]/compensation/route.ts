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

function extractObjectId(f: PPFiling): string | null {
  if (f.object_id && /^\d{14,}$/.test(f.object_id)) return f.object_id;
  // ProPublica path: "IRS/954016653_202306_990_2024042322369843.pdf"
  // The IRS object ID is the last underscore-segment before the extension
  if (f.pdf_url) {
    try {
      const u = new URL(f.pdf_url);
      const path = decodeURIComponent(u.searchParams.get("path") ?? "");
      const filename = (path.split("/").pop() ?? "").replace(/\.(pdf|xml)$/i, "");
      const segments = filename.split("_");
      for (let i = segments.length - 1; i >= 0; i--) {
        if (/^\d{14,}$/.test(segments[i])) return segments[i];
      }
    } catch {}
  }
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

interface StrategyLog {
  taxYear: number;
  s1_s3_xml: string;
  s2_pp_xml: string;
  s2_url: string | null;
  s3_pdf: string;
  result: "found" | "none";
  recordCount: number;
}

async function resolveScheduleJ(
  f: PPFiling,
  debug: boolean
): Promise<{ result: ScheduleJResult | null; log: StrategyLog }> {
  const taxYear = parseInt(String(f.tax_prd_yr), 10);
  const log: StrategyLog = {
    taxYear,
    s1_s3_xml: "skipped",
    s2_pp_xml: "skipped",
    s2_url: null,
    s3_pdf: "skipped",
    result: "none",
    recordCount: 0,
  };

  // Strategy 1: IRS S3 XML
  const objectId = extractObjectId(f);
  if (objectId) {
    const r = await fetchScheduleJ(objectId, taxYear);
    log.s1_s3_xml = r ? `ok (${r.records.length} records)` : "404/empty";
    if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
  } else {
    log.s1_s3_xml = "no objectId";
  }

  // Strategy 2: IRS S3 XML via full-path filename (ProPublica proxy always 403 server-side)
  // ProPublica path encodes the full filename; try it as a bare S3 key too
  if (f.pdf_url) {
    const xmlUrl = xmlUrlFromPdf(f.pdf_url);
    log.s2_url = xmlUrl;
    if (xmlUrl) {
      // Extract the bare filename from the path and try IRS S3 directly
      try {
        const u = new URL(xmlUrl);
        const path = decodeURIComponent(u.searchParams.get("path") ?? "");
        const filename = path.split("/").pop() ?? "";
        if (filename.endsWith(".xml")) {
          const directS3 = `https://s3.amazonaws.com/irs-form-990/${filename}`;
          const res = await fetch(directS3, {
            next: { revalidate: 86400 },
            headers: { Accept: "application/xml, text/xml, */*" },
          });
          log.s2_pp_xml = `direct-S3 HTTP ${res.status}`;
          if (res.ok) {
            const xml = await res.text();
            const r = await fetchScheduleJFromXmlUrl(directS3, taxYear);
            log.s2_pp_xml += r ? ` → ${r.records.length} records` : " → 0 parsed";
            if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
          }
        }
      } catch (e) {
        log.s2_pp_xml = `error: ${String(e).slice(0, 80)}`;
      }
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
    log.s3_pdf = "skipped (ProPublica proxy 403)";
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

    const outcomes = await Promise.all(
      filings.slice(0, 3).map((f) => resolveScheduleJ(f, debug))
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
