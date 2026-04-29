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

  // Strategy 2: ProPublica XML URL
  if (f.pdf_url) {
    const xmlUrl = xmlUrlFromPdf(f.pdf_url);
    log.s2_url = xmlUrl;
    if (xmlUrl) {
      let xmlStatus = "error";
      try {
        const res = await fetch(xmlUrl, { cache: "no-store" });
        xmlStatus = `HTTP ${res.status}`;
        if (res.ok) {
          const xml = await res.text();
          log.s2_pp_xml = `fetched (${xml.length} chars)`;
          const r = await fetchScheduleJFromXmlUrl(xmlUrl, taxYear);
          log.s2_pp_xml += r ? ` → ${r.records.length} records` : " → 0 records parsed";
          if (r) { log.result = "found"; log.recordCount = r.records.length; return { result: r, log }; }
        } else {
          log.s2_pp_xml = xmlStatus;
        }
      } catch (e) {
        log.s2_pp_xml = `error: ${String(e).slice(0, 80)}`;
      }
    }
  }

  // Strategy 3: PDF parsing
  if (f.pdf_url) {
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
