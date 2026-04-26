import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dataProvider } from "@/lib/providers";

const schema = z.object({
  limit: z.coerce.number().min(1).max(20).default(10),
  category: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { ein: string } }
) {
  const org = await dataProvider.getOrganizationByEin(params.ein);
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  const { limit, category } = parsed.success ? parsed.data : { limit: 10, category: undefined };

  const local = await dataProvider.getLocalOrganizations(
    { city: org.city, state: org.state },
    category ? { nteeCategory: category } : {},
    limit
  );

  return NextResponse.json(local.filter((o) => o.ein !== org.ein));
}
