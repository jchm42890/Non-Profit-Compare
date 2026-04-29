import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;
  const normalized = ein.replace(/-/g, "");
  const base =
    process.env.PROPUBLICA_API_BASE ??
    "https://projects.propublica.org/nonprofits/api/v2";

  // 1. ProPublica filing list
  const ppRes = await fetch(`${base}/organizations/${normalized}.json`, { cache: "no-store" });
  const ppData = await ppRes.json();
  const firstFiling = (ppData.filings_with_data ?? [])[0];
  const taxYear: number = parseInt(String(firstFiling?.tax_prd_yr ?? "2023"), 10);

  // 2. IRS EFTS full-text search (the authoritative object_id source)
  let eftsResult: unknown = null;
  let eftsError: string | null = null;
  try {
    const eftsUrl = `https://efts.irs.gov/LATEST/search-index?q=%22${normalized}%22&dateRange=custom&startDate=${taxYear - 1}-01-01&endDate=${taxYear + 2}-12-31&forms=990,990EZ,990PF`;
    const eftsRes = await fetch(eftsUrl, { cache: "no-store", headers: { Accept: "application/json" } });
    eftsResult = eftsRes.ok ? await eftsRes.json() : `HTTP ${eftsRes.status}`;
  } catch (e) {
    eftsError = String(e);
  }

  // 3. IRS annual index file for the likely filing year
  const indexYear = taxYear + 1; // e.g. tax year 2023 → filed in 2024 index
  let indexMatch: unknown = null;
  let indexError: string | null = null;
  try {
    const idxUrl = `https://s3.amazonaws.com/irs-form-990/index_${indexYear}.json`;
    const idxRes = await fetch(idxUrl, { cache: "no-store" });
    if (idxRes.ok) {
      const idxData = await idxRes.json() as { Filings?: { EIN: string; TaxPeriod: string; ObjectId?: string; URL?: string }[] };
      indexMatch = idxData.Filings?.find(
        (f) => f.EIN === normalized && f.TaxPeriod?.startsWith(String(taxYear))
      ) ?? null;
    } else {
      indexError = `index HTTP ${idxRes.status}`;
    }
  } catch (e) {
    indexError = String(e);
  }

  // 4. Try direct S3 XML with the pdf_url-derived ID anyway (for reference)
  const pdfId = firstFiling?.pdf_url
    ? (() => {
        try {
          const decoded = decodeURIComponent(new URL(firstFiling.pdf_url).searchParams.get("path") ?? "");
          const segs = decoded.split("/").pop()?.replace(".pdf", "").split("_") ?? [];
          return segs[segs.length - 1];
        } catch { return null; }
      })()
    : null;

  return NextResponse.json({
    ein,
    taxYear,
    firstFiling: firstFiling
      ? { tax_prd_yr: firstFiling.tax_prd_yr, object_id: firstFiling.object_id ?? "MISSING", pdf_url: firstFiling.pdf_url }
      : null,
    pdfDerivedId: pdfId,
    eftsError,
    eftsHitCount: (eftsResult as { hits?: { hits?: unknown[] } })?.hits?.hits?.length ?? 0,
    eftsFirstHit: (eftsResult as { hits?: { hits?: { _id: string; _source: unknown }[] } })?.hits?.hits?.[0] ?? null,
    indexYear,
    indexError,
    indexMatch,
  });
}
