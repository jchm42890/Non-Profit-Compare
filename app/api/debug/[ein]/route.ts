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

  // 1. Fetch ProPublica filing list
  const ppRes = await fetch(`${base}/organizations/${normalized}.json`, {
    cache: "no-store",
  });
  const ppData = await ppRes.json();

  const filings = (ppData.filings_with_data ?? []).slice(0, 3);
  const firstFiling = filings[0];

  // 2. Show top-level keys in first filing
  const filingKeys = firstFiling ? Object.keys(firstFiling) : [];

  // 3. Try to fetch the XML if object_id exists
  let xmlPreview: string | null = null;
  let xmlError: string | null = null;
  let s3Url: string | null = null;

  if (firstFiling?.object_id) {
    s3Url = `https://s3.amazonaws.com/irs-form-990/${firstFiling.object_id}_public.xml`;
    try {
      const xmlRes = await fetch(s3Url, { cache: "no-store" });
      if (xmlRes.ok) {
        const text = await xmlRes.text();
        // Show first 2000 chars to reveal structure
        xmlPreview = text.slice(0, 2000);
      } else {
        xmlError = `S3 returned ${xmlRes.status}`;
      }
    } catch (e) {
      xmlError = String(e);
    }
  }

  return NextResponse.json({
    ein,
    filingCount: filings.length,
    firstFiling: firstFiling
      ? {
          tax_prd_yr: firstFiling.tax_prd_yr,
          formtype: firstFiling.formtype,
          object_id: firstFiling.object_id ?? "MISSING",
          pdf_url: firstFiling.pdf_url ?? null,
        }
      : null,
    filingKeys,
    s3Url,
    xmlError,
    xmlPreview,
  });
}
