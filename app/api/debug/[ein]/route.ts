import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function tryUrl(url: string): Promise<{ ok: boolean; status: number; preview?: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "*/*" } });
    if (res.ok) {
      const text = await res.text();
      return { ok: true, status: res.status, preview: text.slice(0, 500) };
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;
  const normalized = ein.replace(/-/g, "");
  const base = process.env.PROPUBLICA_API_BASE ?? "https://projects.propublica.org/nonprofits/api/v2";

  const ppRes = await fetch(`${base}/organizations/${normalized}.json`, { cache: "no-store" });
  const ppData = await ppRes.json();
  const firstFiling = (ppData.filings_with_data ?? [])[0];
  const taxYear: number = parseInt(String(firstFiling?.tax_prd_yr ?? "2023"), 10);

  // Extract the last segment from the pdf_url filename
  let pdfId: string | null = null;
  let fullFilename: string | null = null;
  if (firstFiling?.pdf_url) {
    try {
      const decoded = decodeURIComponent(new URL(firstFiling.pdf_url).searchParams.get("path") ?? "");
      fullFilename = decoded.split("/").pop()?.replace(".pdf", "") ?? null;
      const segs = fullFilename?.split("_") ?? [];
      pdfId = segs[segs.length - 1] ?? null;
    } catch {}
  }

  // Try every plausible S3 XML URL pattern
  const candidates: Record<string, string> = {};
  if (pdfId) {
    candidates["id_only"] = `https://s3.amazonaws.com/irs-form-990/${pdfId}_public.xml`;
  }
  if (fullFilename) {
    candidates["full_filename"] = `https://s3.amazonaws.com/irs-form-990/${fullFilename}_public.xml`;
    candidates["full_no_suffix"] = `https://s3.amazonaws.com/irs-form-990/${fullFilename}.xml`;
  }
  // Try IRS apps.irs.gov hosting
  if (fullFilename) {
    candidates["apps_irs_gov"] = `https://apps.irs.gov/pub/epostcard/990/xml/${taxYear + 1}/${fullFilename}_public.xml`;
  }
  // Try quarterly IRS index files
  for (const yr of [taxYear + 1, taxYear]) {
    for (const q of ["01", "02", "03", "04"]) {
      candidates[`index_${yr}_${q}`] = `https://s3.amazonaws.com/irs-form-990/index_${yr}_${q}.json`;
    }
  }

  const results: Record<string, { ok: boolean; status: number; preview?: string }> = {};
  await Promise.all(
    Object.entries(candidates).map(async ([key, url]) => {
      results[key] = await tryUrl(url);
    })
  );

  return NextResponse.json({
    ein, taxYear, fullFilename, pdfId,
    urlTests: Object.fromEntries(
      Object.entries(candidates).map(([k, url]) => [k, { url, ...results[k] }])
    ),
  });
}
