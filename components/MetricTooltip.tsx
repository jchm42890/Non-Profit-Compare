"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

interface MetricTooltipProps {
  content: string;
  className?: string;
}

export function MetricTooltip({ content, className }: MetricTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className={cn("h-3.5 w-3.5 text-muted-foreground cursor-help inline-block ml-1", className)} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
