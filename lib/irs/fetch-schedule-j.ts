import { XMLParser } from "fast-xml-parser";

export interface CompensationRecord {
  name: string;
  title: string;
  hoursPerWeek?: number;
  baseCompensation?: number;
  bonusCompensation?: number;
  otherCompensation?: number;
  deferredCompensation?: number;
  nontaxableBenefits?: number;
  totalCompensation?: number;
  compFromRelatedOrgs?: number;
}

export interface ScheduleJResult {
  taxYear: number;
  objectId: string;
  records: CompensationRecord[];
}

const S3_BASE = "https://s3.amazonaws.com/irs-form-990";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,       // strips "irs:" / "xsi:" etc. from element names
  parseTagValue: true,
  trimValues: true,
  // Treat these as always-array so single records don't collapse to an object
  isArray: (name) =>
    [
      "OfficerDirectorTrusteeKeyEmplGrp",
      "OfficerDirectorTrusteeKeyEmpl",
      "RltdOrgOfficerTrstKeyEmplGrp",
      "HighestCompensatedEmployeeGrp",
      "HighestCompensatedEmployee",
      "IndividualTrusteeOrDirectorGrp",
      "IndividualTrusteeOrDirector",
      "Form990PartVIISectionAGrp",
    ].includes(name),
});

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return isNaN(n) || n === 0 ? undefined : n;
}

function personName(row: Record<string, unknown>): string {
  // Try direct PersonNm first
  if (typeof row["PersonNm"] === "string" && row["PersonNm"]) return row["PersonNm"] as string;
  // BusinessName object
  const bn = row["BusinessName"] as Record<string, unknown> | undefined;
  if (bn) {
    const line = bn["BusinessNameLine1Txt"] ?? bn["BusinessNameLine1"];
    if (typeof line === "string" && line) return line;
  }
  // Fallback scalar
  const fallback = row["NameOfOfficer"] ?? row["Name"];
  return typeof fallback === "string" ? fallback : "";
}

function extractScheduleJRecords(schedJ: Record<string, unknown>): CompensationRecord[] {
  // Schedule J Part II — multiple possible element names across filing years
  const groupKeys = [
    "RltdOrgOfficerTrstKeyEmplGrp",
    "OfficerDirectorTrusteeKeyEmplGrp",
    "OfficerDirectorTrusteeKeyEmpl",
  ];

  let rows: unknown[] = [];
  for (const key of groupKeys) {
    const val = schedJ[key];
    if (val) {
      rows = Array.isArray(val) ? val : [val];
      break;
    }
  }

  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      const name = personName(row);
      if (!name) return null;
      return {
        name,
        title: String(row["TitleTxt"] ?? row["TitleOfOfficer"] ?? ""),
        hoursPerWeek: num(row["AverageHoursPerWeekRt"] ?? row["AverageHoursPerWeek"]),
        baseCompensation: num(row["BaseCompensationFilingOrgAmt"] ?? row["BaseCompensation"]),
        bonusCompensation: num(row["BonusFilingOrganizationAmount"] ?? row["BonusAndIncentiveCompensation"]),
        otherCompensation: num(row["OtherCompensationFilingOrganizationAmount"] ?? row["OtherCompensation"]),
        deferredCompensation: num(row["DeferredCompensationFilerAmt"] ?? row["DeferredCompensation"]),
        nontaxableBenefits: num(row["NontaxableBenefitsFilingOrgAmt"] ?? row["NontaxableBenefits"]),
        totalCompensation: num(row["TotalCompensationFilingOrgAmt"] ?? row["TotalCompensation"]),
        compFromRelatedOrgs: num(row["ReportableCompFromRltdOrgAmt"] ?? row["CompensationFromRelatedOrgs"]),
      } as CompensationRecord;
    })
    .filter((r): r is CompensationRecord => r !== null && r.name !== "");
}

// Fallback: Part VII Section A of the core 990 (no Schedule J required)
function extractPartVII(return990: Record<string, unknown>): CompensationRecord[] {
  const groupKeys = ["Form990PartVIISectionAGrp", "Form990PartVII", "PartVIISectionA"];
  let rows: unknown[] = [];
  for (const key of groupKeys) {
    const val = return990[key];
    if (val) {
      rows = Array.isArray(val) ? val : [val];
      break;
    }
  }

  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      const name = personName(row);
      if (!name) return null;
      const base = num(row["ReportableCompFromOrgAmt"] ?? row["ReportableComp"]);
      const other = num(row["OtherCompensationAmt"] ?? row["OtherComp"]);
      const total =
        base != null || other != null ? (base ?? 0) + (other ?? 0) : undefined;
      if (!total) return null;
      return {
        name,
        title: String(row["TitleTxt"] ?? ""),
        hoursPerWeek: num(row["AverageHoursPerWeekRt"]),
        baseCompensation: base,
        compFromRelatedOrgs: num(row["ReportableCompFromRltdOrgAmt"]),
        otherCompensation: other,
        totalCompensation: total,
      } as CompensationRecord;
    })
    .filter((r): r is CompensationRecord => r !== null && r.name !== "");
}

// Try multiple S3 URL patterns — the object_id format has changed over years
async function tryFetchXml(objectId: string): Promise<string | null> {
  const urls = [
    `${S3_BASE}/${objectId}_public.xml`,
    // Some older filings use a path prefix
    `https://irs-form-990.s3.amazonaws.com/${objectId}_public.xml`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 86400 },
        headers: { Accept: "application/xml, text/xml, */*" },
      });
      if (res.ok) return res.text();
    } catch {}
  }
  return null;
}

// Recursively search a parsed XML object for a key, depth-first
function deepFind(
  obj: unknown,
  key: string,
  depth = 0
): Record<string, unknown> | null {
  if (depth > 6 || obj == null || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (key in o) return o[key] as Record<string, unknown>;
  for (const v of Object.values(o)) {
    const found = deepFind(v, key, depth + 1);
    if (found) return found;
  }
  return null;
}

export async function fetchScheduleJ(
  objectId: string,
  taxYear: number
): Promise<ScheduleJResult | null> {
  const xml = await tryFetchXml(objectId);
  if (!xml) return null;
  return parseXml(xml, objectId, taxYear);
}

// Fetch XML from any arbitrary URL (e.g. ProPublica's own hosting)
export async function fetchScheduleJFromXmlUrl(
  xmlUrl: string,
  taxYear: number
): Promise<ScheduleJResult | null> {
  try {
    const res = await fetch(xmlUrl, {
      next: { revalidate: 86400 },
      headers: { Accept: "application/xml, text/xml, */*" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    return parseXml(xml, xmlUrl, taxYear);
  } catch {
    return null;
  }
}

function parseXml(
  xml: string,
  sourceId: string,
  taxYear: number
): ScheduleJResult | null {
  try {
    const doc = parser.parse(xml) as Record<string, unknown>;

    const schedJ = deepFind(doc, "IRS990ScheduleJ") as Record<string, unknown> | null;
    if (schedJ) {
      const records = extractScheduleJRecords(schedJ);
      if (records.length) return { taxYear, objectId: sourceId, records };
    }

    const return990 = deepFind(doc, "IRS990") as Record<string, unknown> | null;
    if (return990) {
      const records = extractPartVII(return990);
      if (records.length) return { taxYear, objectId: sourceId, records };
    }

    return null;
  } catch {
    return null;
  }
}
