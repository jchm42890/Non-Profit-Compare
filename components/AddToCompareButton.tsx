"use client";

import { Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompareStore, MAX_COMPARE_ITEMS } from "@/lib/compare/store";
import type { CompareEntry } from "@/types";
import { cn } from "@/lib/utils/cn";

interface AddToCompareButtonProps {
  entry: CompareEntry;
  size?: "sm" | "default";
  className?: string;
}

export function AddToCompareButton({ entry, size = "sm", className }: AddToCompareButtonProps) {
  const { add, remove, has, isFull } = useCompareStore();
  const added = has(entry.ein);
  const full = isFull();

  if (added) {
    return (
      <Button
        size={size}
        variant="secondary"
        className={cn("gap-1.5", className)}
        onClick={() => remove(entry.ein)}
      >
        <Check className="h-3.5 w-3.5 text-green-600" />
        Added
        <X className="h-3.5 w-3.5 ml-0.5 opacity-60" />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      className={cn("gap-1.5", className)}
      onClick={() => add(entry)}
      disabled={full}
      title={full ? `Maximum ${MAX_COMPARE_ITEMS} nonprofits in comparison` : "Add to comparison"}
    >
      <Plus className="h-3.5 w-3.5" />
      {full ? "Compare Full" : "Compare"}
    </Button>
  );
}
