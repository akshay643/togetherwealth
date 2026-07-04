import { Info } from "lucide-react";
import { EDUCATION_DISCLAIMER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface DisclaimerNoteProps {
  className?: string;
}

/**
 * Muted small print with the education disclaimer. Render wherever
 * projections, comparisons, or other educational content appears.
 */
export function DisclaimerNote({ className }: DisclaimerNoteProps) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-muted-foreground",
        className
      )}
    >
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{EDUCATION_DISCLAIMER}</span>
    </p>
  );
}
