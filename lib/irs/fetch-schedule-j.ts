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
  ignoreAttributes: false,
  attributeNamePrefix: "_",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) =>
    [
      "OfficerDirectorTrusteeKeyEmpl",
      "OfficerDirectorTrusteeKeyEmployee",
      "HighestCompensatedEmployee",
      "IndividualTrusteeOrDirector",
    ].includes(name),
});

function num(v: unknown): number | undefined {
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o["BusinessNameLine1Txt"] ?? o["PersonNm"] ?? "");
  }
  return String(v);
}

function extractRecords(schedJ: Record<string, unknown>): CompensationRecord[] {
  const records: CompensationRecord[] = [];

  // Part II — Officers, Directors, Trustees, Key Employees
  const partII = schedJ["RltdOrgOfficerTrstKeyEmplGrp"] ?? schedJ["OfficerDirectorTrusteeKeyEmpl"];
  const rows = Array.isArray(partII) ? partII : partII ? [partII] : [];

  for (const row of rows as Record<string, unknown>[]) {
    const name =
      str(row["PersonNm"]) ||
      str(row["BusinessName"]) ||
      str(row["NameOfOfficer"]);
    if (!name) continue;

    records.push({
      name,
      title: str(row["TitleTxt"] ?? row["TitleOfOfficer"]),
      hoursPerWeek: num(row["AverageHoursPerWeekRt"] ?? row["AverageHoursPerWeek"]),
      baseCompensation: num(row["BaseCompensationFilingOrgAmt"] ?? row["BaseCompensation"]),
      bonusCompensation: num(row["BonusFilingOrganizationAmount"] ?? row["Bonus"]),
      otherCompensation: num(row["OtherCompensationFilingOrganizationAmount"] ?? row["OtherCompensation"]),
      deferredCompensation: num(row["DeferredCompensationFilerAmt"] ?? row["DeferredCompensation"]),
      nontaxableBenefits: num(row["NontaxableBenefitsFilingOrgAmt"] ?? row["NontaxableBenefits"]),
      totalCompensation: num(row["TotalCompensationFilingOrgAmt"] ?? row["TotalCompensation"]),
      compFromRelatedOrgs: num(row["ReportableCompFromRltdOrgAmt"] ?? row["CompFromRelatedOrganizations"]),
    });
  }

  return records;
}

// Fallback: extract from Part VII of core 990 when Schedule J is absent
function extractPartVII(return990: Record<string, unknown>): CompensationRecord[] {
  const partVII = return990["Form990PartVIISectionAGrp"] ?? return990["PartVII"];
  const rows = Array.isArray(partVII) ? partVII : partVII ? [partVII] : [];
  const records: CompensationRecord[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    const name =
      str(row["PersonNm"]) ||
      str(row["BusinessName"]);
    if (!name) continue;

    records.push({
      name,
      title: str(row["TitleTxt"]),
      hoursPerWeek: num(row["AverageHoursPerWeekRt"]),
      baseCompensation: num(row["ReportableCompFromOrgAmt"]),
      compFromRelatedOrgs: num(row["ReportableCompFromRltdOrgAmt"]),
      otherCompensation: num(row["OtherCompensationAmt"]),
      totalCompensation:
        num(row["ReportableCompFromOrgAmt"]) != null
          ? (num(row["ReportableCompFromOrgAmt"]) ?? 0) +
            (num(row["OtherCompensationAmt"]) ?? 0)
          : undefined,
    });
  }

  return records.filter((r) => (r.totalCompensation ?? 0) > 0);
}

export async function fetchScheduleJ(
  objectId: string,
  taxYear: number
): Promise<ScheduleJResult | null> {
  const url = `${S3_BASE}/${objectId}_public.xml`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // cache 24h — IRS files never change
      headers: { Accept: "application/xml, text/xml, */*" },
    });

    if (!res.ok) return null;

    const xml = await res.text();
    const doc = parser.parse(xml) as Record<string, unknown>;

    const root =
      (doc["Return"] as Record<string, unknown>) ??
      (doc["return"] as Record<string, unknown>);
    if (!root) return null;

    const returnData = root["ReturnData"] as Record<string, unknown> | undefined;
    const return990 = returnData?.["IRS990"] as Record<string, unknown> | undefined;
    const schedJ = returnData?.["IRS990ScheduleJ"] as Record<string, unknown> | undefined;

    const records = schedJ
      ? extractRecords(schedJ)
      : return990
      ? extractPartVII(return990)
      : [];

    return { taxYear, objectId, records };
  } catch {
    return null;
  }
}
