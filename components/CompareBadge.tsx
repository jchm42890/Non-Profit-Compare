"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useCompareStore } from "@/lib/compare/store";
import { Button } from "@/components/ui/button";

export function CompareBadge() {
  const entries = useCompareStore((s) => s.entries);
  const count = entries.length;

  return (
    <Button variant={count > 0 ? "default" : "outline"} size="sm" asChild className="relative gap-2">
      <Link href="/compare">
        <BarChart3 className="h-4 w-4" />
        Compare
        {count > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary text-xs font-bold">
            {count}
          </span>
        )}
      </Link>
    </Button>
  );
}
