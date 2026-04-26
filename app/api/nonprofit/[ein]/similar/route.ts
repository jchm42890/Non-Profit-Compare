import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dataProvider } from "@/lib/providers";
import type { SimilarityStrategy } from "@/lib/providers/types";

const schema = z.object({
  strategy: z.enum(["ntee", "geography", "size", "combined"]).default("combined"),
  limit: z.coerce.number().min(1).max(20).default(6),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { ein: string } }
) {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  const { strategy, limit } = parsed.success ? parsed.data : { strategy: "combined" as SimilarityStrategy, limit: 6 };

  const similar = await dataProvider.getSimilarOrganizations(params.ein, strategy, limit);
  return NextResponse.json(similar);
}
