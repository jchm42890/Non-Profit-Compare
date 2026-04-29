import type { CompensationRecord } from "./fetch-schedule-j";

// Extracts officer compensation from a 990 PDF by parsing the raw text.
// Works on standard IRS e-filed returns (Part VII Section A layout).
export async function extractOfficersFromPdf(
  pdfUrl: string
): Promise<CompensationRecord[]> {
  const res = await fetch(pdfUrl, {
    next: { revalidate: 86400 },
    headers: { Accept: "application/pdf, */*" },
  });
  if (!res.ok) return [];

  const buffer = Buffer.from(await res.arrayBuffer());

  // Dynamically import to avoid SSR/edge issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: any = await import("pdf-parse");
  const fn = pdfParse.default ?? pdfParse;
  const { text } = await fn(buffer, { max: 0 });

  return parsePartVIIText(text);
}

// ── Text parser ────────────────────────────────────────────────────────────────
// Part VII Section A in a 990 PDF has rows like:
//   John A. Smith                     40.00  X  X      285,000.    0.   42,000.
//   President & CEO
// The name appears first, then the title on the next line, then numbers.

function parseDollar(s: string): number | undefined {
  const clean = s.replace(/[,$\s]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) || n < 0 ? undefined : n;
}

function parsePartVIIText(text: string): CompensationRecord[] {
  // Normalize whitespace
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Find the Part VII Section A boundary
  const startIdx = lines.findIndex((l) =>
    /Part\s+VII/i.test(l) && /Section\s+A/i.test(l)
  );
  // Find end boundary (Part VIII or Schedule section)
  const endIdx = lines.findIndex(
    (l, i) => i > startIdx + 2 && /Part\s+VIII|Schedule\s+[A-Z]/i.test(l)
  );

  const slice =
    startIdx >= 0
      ? lines.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 200)
      : lines.slice(0, 300); // fallback: scan first 300 lines

  const records: CompensationRecord[] = [];

  // Pattern: a line with a dollar-amount cluster at the end (reportable comp)
  // Numbers look like: 285,000. or 285,000 or 285000
  const numPattern = /[\d,]+\.?\d*$/;
  const multiNumLine = /(?:[\d,]+\.?\s+){2,}/;

  let i = 0;
  while (i < slice.length) {
    const line = slice[i];

    if (multiNumLine.test(line)) {
      // Extract all numeric tokens from this line
      const nums = line.match(/[\d,]+\.?\d*/g)?.map(parseDollar) ?? [];

      // The name is on the previous non-numeric line
      let name = "";
      let j = i - 1;
      while (j >= 0 && !multiNumLine.test(slice[j]) && j > i - 4) {
        const candidate = slice[j].replace(/\d+\.\d+/g, "").trim();
        if (candidate.length > 3 && /[A-Z][a-z]/.test(candidate)) {
          name = candidate;
          break;
        }
        j--;
      }

      // Title is often on the line right after the numbers or between name and numbers
      let title = "";
      if (i + 1 < slice.length && !multiNumLine.test(slice[i + 1])) {
        const t = slice[i + 1].replace(/^\d+\.\d+/, "").trim();
        if (t.length > 1 && !/^\d/.test(t)) title = t;
      }

      // reportable comp from org is typically the first large number
      const base = nums.find((n) => n != null && n > 0);
      const other = nums[2]; // F column (other comp)

      if (name && base != null && base > 1000) {
        records.push({
          name,
          title,
          baseCompensation: base,
          otherCompensation: other,
          totalCompensation: (base ?? 0) + (other ?? 0),
        });
      }
    }

    i++;
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return records.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}
