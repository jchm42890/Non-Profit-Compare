import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dataProvider } from "@/lib/providers";

const schema = z.object({
  q: z.string().default(""),
  state: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(10),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { q, state, category, page, pageSize } = parsed.data;

  const filters = {
    ...(state ? { state } : {}),
    ...(category ? { nteeCategory: category } : {}),
  };

  try {
    const result = await dataProvider.searchOrganizations(q, filters, page, pageSize);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ organizations: [], total: 0, page, pageSize });
  }
}
