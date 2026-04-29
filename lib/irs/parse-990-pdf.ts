import type { CompensationRecord } from "./fetch-schedule-j";

export async function extractOfficersFromPdf(
  pdfUrl: string
): Promise<CompensationRecord[]> {
  const res = await fetch(pdfUrl, {
    next: { revalidate: 86400 },
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/pdf, application/octet-stream, */*",
      "Referer": "https://projects.propublica.org/nonprofits/",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching PDF`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf") && !contentType.includes("octet")) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: any = await import("pdf-parse");
  const fn = pdfParse.default ?? pdfParse;
  const { text } = await fn(buffer, { max: 0 });

  return parsePartVIIText(text);
}

// ── Dollar parser ───────────────────────────────────────────────────────────

function parseDollar(s: string): number | undefined {
  const clean = s.replace(/[,$\s]/g, "").replace(/\.$/, "");
  const n = parseFloat(clean);
  return isNaN(n) || n < 0 ? undefined : n;
}

// ── Part VII Section A parser ───────────────────────────────────────────────
//
// IRS 990 PDFs (e-filed, 2009+) follow a consistent layout in Part VII.
// After extracting text with pdf-parse, the output is roughly:
//
//   Part VII  Section A. Officers, Directors, Trustees, Key Employees, ...
//   (A) Name and Title  (B) Avg hrs  (C) Position  (D) Reportable comp ...
//   John A. Smith
//   President & CEO
//   40.00   X   X   285,000.  0.  42,000.
//   Jane B. Jones
//   CFO
//   40.00   X       185,000.  0.  30,000.
//
// OR with name/title/numbers on fewer lines, depending on the PDF renderer.
// We use a heuristic: collect lines between Part VII Section A and Part VIII,
// then look for lines that contain ≥2 dollar-amount-like tokens.  The nearest
// preceding line that looks like a person name is the officer name.

export function parsePartVIIText(text: string): CompensationRecord[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Find Part VII Section A start
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/Part\s+VII/i.test(lines[i]) && /Section\s+A/i.test(lines[i])) {
      startIdx = i;
      break;
    }
    // Sometimes "Part VII" and "Section A" are on separate consecutive lines
    if (/Part\s+VII/i.test(lines[i]) && i + 1 < lines.length && /Section\s+A/i.test(lines[i + 1])) {
      startIdx = i;
      break;
    }
  }

  // Find end boundary
  let endIdx = lines.length;
  if (startIdx >= 0) {
    for (let i = startIdx + 5; i < lines.length; i++) {
      if (/Part\s+VIII/i.test(lines[i]) || /Schedule\s+[A-Z]\b/i.test(lines[i])) {
        endIdx = i;
        break;
      }
    }
  }

  // Work within the slice (or first 400 lines as fallback)
  const slice =
    startIdx >= 0
      ? lines.slice(startIdx, endIdx)
      : lines.slice(0, 400);

  // A "dollar cluster" line: 3+ tokens that look like dollar amounts or hours
  // e.g.  "40.00   X   X   285,000.  0.  42,000."
  // Dollar amount pattern: digits possibly with commas, optional trailing dot
  const dollarToken = /^\d[\d,]*\.?\d*$/;

  function isDollarCluster(line: string): boolean {
    const tokens = line.split(/\s+/).filter(Boolean);
    const dollarCount = tokens.filter((t) => dollarToken.test(t)).length;
    return dollarCount >= 3;
  }

  // A line looks like a person name if it has 2+ capitalized words and no digits
  function looksLikeName(line: string): boolean {
    if (/\d/.test(line)) return false;
    if (line.length < 4 || line.length > 80) return false;
    const words = line.split(/\s+/);
    const capWords = words.filter((w) => /^[A-Z][a-z]/.test(w));
    return capWords.length >= 2;
  }

  // A line looks like a title/position
  function looksLikeTitle(line: string): boolean {
    if (/\d/.test(line) && !/^\d+\.\d{2}$/.test(line.trim())) return false;
    if (line.length < 2 || line.length > 100) return false;
    return /[A-Za-z]{3,}/.test(line);
  }

  const records: CompensationRecord[] = [];

  for (let i = 0; i < slice.length; i++) {
    if (!isDollarCluster(slice[i])) continue;

    // Extract dollar amounts from this line
    const tokens = slice[i].split(/\s+/).filter(Boolean);
    const nums = tokens
      .filter((t) => dollarToken.test(t))
      .map(parseDollar);

    // Walk backwards to find the name
    let name = "";
    let title = "";
    for (let back = i - 1; back >= Math.max(0, i - 5) && !name; back--) {
      const candidate = slice[back];
      if (isDollarCluster(candidate)) break; // hit previous record
      if (looksLikeName(candidate)) {
        name = candidate;
        // Check if the line right after name (before numbers) is a title
        if (back + 1 < i && looksLikeTitle(slice[back + 1]) && !isDollarCluster(slice[back + 1])) {
          title = slice[back + 1];
        }
      }
    }

    // Sometimes name and title are on the same line (less common)
    if (!name) {
      // Look for line right before numbers that has letters
      for (let back = i - 1; back >= Math.max(0, i - 2); back--) {
        if (!isDollarCluster(slice[back]) && /[A-Za-z]{3,}/.test(slice[back])) {
          const parts = slice[back].split(/\s{3,}/); // wide gap = columns
          if (parts.length >= 2) {
            name = parts[0].trim();
            title = parts[1].trim();
          } else {
            name = slice[back].trim();
          }
          break;
        }
      }
    }

    if (!name) continue;

    // nums layout in Part VII: hours, (checkboxes skipped), reportable comp from org,
    // reportable comp from related orgs, other compensation
    // After filtering out hour-like values (< 200 and not zero), find comp values
    const compNums = nums.filter((n) => n != null && n >= 0) as number[];

    // The first large number (>= 1000) is typically reportable comp from org
    const base = compNums.find((n) => n >= 1000);
    if (!base) continue; // no meaningful comp found

    const otherIdx = compNums.lastIndexOf(compNums[compNums.length - 1]);
    const other = compNums.length >= 3 ? compNums[compNums.length - 1] : undefined;

    records.push({
      name: name.replace(/\s+/g, " ").trim(),
      title: title.replace(/\s+/g, " ").trim(),
      baseCompensation: base,
      otherCompensation: other && other !== base ? other : undefined,
      totalCompensation: base + (other && other !== base ? other : 0),
    });
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return records.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}
