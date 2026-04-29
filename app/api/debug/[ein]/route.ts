import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function objectIdFromPdfUrl(pdfUrl: string): string | null {
  try {
    const decoded = decodeURIComponent(new URL(pdfUrl).searchParams.get("path") ?? "");
    const filename = decoded.split("/").pop()?.replace(".pdf", "") ?? "";
    const segments = filename.split("_");
    const candidate = segments[segments.length - 1];
    if (/^\d{10,}$/.test(candidate)) return candidate;
  } catch {}
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: { ein: string } }
) {
  const { ein } = params;
  const normalized = ein.replace(/-/g, "");
  const base =
    process.env.PROPUBLICA_API_BASE ??
    "https://projects.propublica.org/nonprofits/api/v2";

  const ppRes = await fetch(`${base}/organizations/${normalized}.json`, { cache: "no-store" });
  const ppData = await ppRes.json();
  const filings = (ppData.filings_with_data ?? []).slice(0, 3);
  const first = filings[0];

  const directObjectId = first?.object_id && /^\d+$/.test(first.object_id) ? first.object_id : null;
  const pdfObjectId = first?.pdf_url ? objectIdFromPdfUrl(first.pdf_url) : null;
  const resolvedObjectId = directObjectId ?? pdfObjectId;

  let xmlPreview: string | null = null;
  let xmlError: string | null = null;
  let s3Url: string | null = null;

  if (resolvedObjectId) {
    s3Url = `https://s3.amazonaws.com/irs-form-990/${resolvedObjectId}_public.xml`;
    try {
      const xmlRes = await fetch(s3Url, { cache: "no-store" });
      if (xmlRes.ok) {
        const text = await xmlRes.text();
        xmlPreview = text.slice(0, 3000);
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
    firstFiling: first ? { tax_prd_yr: first.tax_prd_yr, formtype: first.formtype, object_id: first.object_id ?? "MISSING", pdf_url: first.pdf_url ?? null } : null,
    directObjectId,
    pdfObjectId,
    resolvedObjectId,
    s3Url,
    xmlError,
    xmlPreview,
  });
}
