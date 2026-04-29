import { NextResponse } from "next/server";
import { fetchScheduleJFromXmlUrl, type ScheduleJResult } from "@/lib/irs/fetch-schedule-j";

export const dynamic = "force-dynamic";
// Allow up to 30s on Vercel Pro; Hobby plan caps at 10s regardless
export const maxDuration = 30;

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
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { filings_with_data?: PPFiling[] };
  return data.filings_with_data ?? [];
}

// Returns the 2–3 most likely IRS S3 URLs for a filing.
// Priority: explicit objectId → filename-only _public.xml → full path.
function buildS3Candidates(f: PPFiling): string[] {
  const candidates: string[] = [];

  // 1. ProPublica-provided objectId (most reliable when present)
  if (f.object_id && /^\d{14,}$/.test(f.object_id)) {
    candidates.push(`${S3_BASE}/${f.object_id}_public.xml`);
    return candidates; // objectId is definitive — no need to try others
  }

  if (!f.pdf_url) return candidates;

  try {
    const u = new URL(f.pdf_url);
    const rawPath = decodeURIComponent(u.searchParams.get("path") ?? "");
    const xmlPath = rawPath.replace(/\.pdf$/i, ".xml");
    const filename = xmlPath.split("/").pop() ?? "";
    if (!filename) return candidates;

    // 2. Filename-only as S3 key with _public suffix (most common IRS format)
    candidates.push(`${S3_BASE}/${filename.replace(/\.xml$/, "_public.xml")}`);
    // 3. Filename-only without _public
    candidates.push(`${S3_BASE}/${filename}`);
    // 4. Full ProPublica path (in case IRS mirrors it)
    if (xmlPath.includes("/")) {
      candidates.push(`${S3_BASE}/${xmlPath}`);
    }
  } catch {}

  return candidates;
}

async function tryS3Url(
  url: string,
  taxYear: number
): Promise<ScheduleJResult | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/xml, text/xml, */*" },
    });
    if (!res.ok) return null;
    return await fetchScheduleJFromXmlUrl(url, taxYear);
  } catch {
    return null;
  }
}

interface StrategyLog {
  taxYear: number;
  ppObjectId: string;
  candidates: string[];
  result: "found" | "none";
  recordCount: number;
}

async function resolveScheduleJ(
  f: PPFiling,
  debug: boolean
): Promise<{ result: ScheduleJResult | null; log: StrategyLog }> {
  const taxYear = parseInt(String(f.tax_prd_yr), 10);
  const candidates = buildS3Candidates(f);
  const log: StrategyLog = {
    taxYear,
    ppObjectId: f.object_id ?? "(none)",
    candidates: debug ? candidates : [],
    result: "none",
    recordCount: 0,
  };

  // Try candidates in parallel — fast-fail on first success
  const results = await Promise.allSettled(
    candidates.map((url) => tryS3Url(url, taxYear))
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value && r.value.records.length > 0) {
      log.result = "found";
      log.recordCount = r.value.records.length;
      return { result: r.value, log };
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
      filings.slice(0, 5).map((f) => resolveScheduleJ(f, debug))
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
