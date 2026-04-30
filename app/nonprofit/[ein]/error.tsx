"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NonprofitError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[nonprofit page error]", error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <h2 className="text-2xl font-bold mb-3">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        We couldn&apos;t load this organization&apos;s profile. This is usually
        a temporary issue with the data provider.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-6 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/search">Back to search</Link>
        </Button>
      </div>
    </div>
  );
}
