import { NextRequest, NextResponse } from "next/server";
import { dataProvider } from "@/lib/providers";

export async function GET(
  _req: NextRequest,
  { params }: { params: { ein: string } }
) {
  const org = await dataProvider.getOrganizationByEin(params.ein);
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(org);
}
