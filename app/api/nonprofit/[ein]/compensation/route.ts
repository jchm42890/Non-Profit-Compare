import { NextResponse } from "next/server";
import { fetchScheduleJFromXmlUrl, type ScheduleJResult } from "@/lib/irs/fetch-schedule-j";

export const dynamic = "force-dynamic";

const S3_BASE = "https://s3.amazonaws.com/irs-form-990";

interface PPFiling {
  tax_prd_yr: string | number;
  object_id?: string;
  pdf_url?: string;
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

// Build every plausible IRS S3 URL from a ProPublica pdf_url.
// ProPublica's path parameter encodes where they stored the filing:
//   - "IRS/954016653_202306_990_2024042322369843.xml"   (newer: may be in IRS S3 root or IRS/ prefix)
//   - "04_2021_prefixes_95-99/954016653_202006_990_2021040617897708.xml"  (older: ProPublica batch)
// We try: full path as S3 key, filename-only as S3 key, _public.xml variants, and
// the ProPublica objectId format {YYYYMMDD}{8-digit-seq}_public.xml.
function buildS3Candidates(pdfUrl: string): string[] {
  const candidates: string[] = [];
  try {
    const u = new URL(pdfUrl);
    const rawPath = decodeURIComponent(u.searchParams.get("path") ?? "");
    // Normalise to .xml (could be .pdf)
    const xmlPath = rawPath.replace(/\.pdf$/i, ".xml");
    const filename = xmlPath.split("/").pop() ?? "";

    if (!filename) return candidates;

    // Full ProPublica path as S3 key (works if IRS S3 mirrors this structure)
    candidates.push(`${S3_BASE}/${xmlPath}`);
    candidates.push(`${S3_BASE}/${xmlPath.replace(/\.xml$/, "_public.xml")}`);

    // Filename-only (no subdirectory)
    candidates.push(`${S3_BASE}/${filename}`);
    candidates.push(`${S3_BASE}/${filename.replace(/\.xml$/, "_public.xml")}`);

    // ProPublica's internal ID is the last _-segment: e.g. "2024042322369843"
    // The IRS objectId for the same filing starts with the same date (YYYYMMDD)
    // but may differ in the trailing sequence. Try common IRS sequence suffixes:
    const nameNoExt = filename.replace(/\.xml$/, "");
    const segments = nameNoExt.split("_");
    const ppId = segments[segments.length - 1]; // e.g. "2024042322369843"
    if (/^\d{16}$/.test(ppId)) {
      // IRS objectIds we've seen are 15 digits: YYYYMMDD + 7 digits
      // ProPublica's are 16 digits: YYYYMMDD + 8 digits
      // Try dropping the 9th digit (index 8) — first digit of the sequence
      const datepart = ppId.slice(0, 8); // "20240423"
      const seq8 = ppId.slice(8);        // "22369843"
      // Common IRS sequences seen in public data end with 9349303
      for (const suffix of ["9349303", "0000001", seq8.slice(1)]) {
        candidates.push(`${S3_BASE}/${datepart}${suffix}_public.xml`);
      }
    }
  } catch {}
  return candidates;
}

interface StrategyLog {
  taxYear: number;
  ppObjectId: string;
  s3Attempts: { url: string; status: string }[];
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
    ppObjectId: f.object_id ?? "(none)",
    s3Attempts: [],
    result: "none",
    recordCount: 0,
  };

  // Collect all candidate URLs: ProPublica objectId (if present) first, then path-derived
  const candidates: string[] = [];

  if (f.object_id && /^\d{14,}$/.test(f.object_id)) {
    candidates.push(`${S3_BASE}/${f.object_id}_public.xml`);
  }

  if (f.pdf_url) {
    for (const c of buildS3Candidates(f.pdf_url)) {
      if (!candidates.includes(c)) candidates.push(c);
    }
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 86400 },
        headers: { Accept: "application/xml, text/xml, */*" },
      });
      const statusStr = `HTTP ${res.status}`;

      if (res.ok) {
        const r = await fetchScheduleJFromXmlUrl(url, taxYear);
        const detail = r
          ? `${statusStr} → ${r.records.length} records`
          : `${statusStr} → 0 records parsed`;
        log.s3Attempts.push({ url, status: detail });
        if (r && r.records.length > 0) {
          log.result = "found";
          log.recordCount = r.records.length;
          return { result: r, log };
        }
      } else {
        if (debug) log.s3Attempts.push({ url, status: statusStr });
      }
    } catch (e) {
      if (debug)
        log.s3Attempts.push({ url, status: `error: ${String(e).slice(0, 60)}` });
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
      filings.slice(0, 6).map((f) => resolveScheduleJ(f, debug))
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
