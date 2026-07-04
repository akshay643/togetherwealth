import type { LucideIcon } from "lucide-react";
import { Home, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VISIBILITY_META, type Visibility } from "@/lib/constants";
import { cn } from "@/lib/utils";

const VISIBILITY_ICONS: Record<Visibility, LucideIcon> = {
  private: Lock,
  shared: Users,
  household: Home,
};

/** Compact badge text; the full label + description live in the tooltip. */
const SHORT_LABELS: Record<Visibility, string> = {
  private: "Private",
  shared: "Shared",
  household: "Household",
};

export interface VisibilityBadgeProps {
  visibility: Visibility;
  className?: string;
}

/** Small badge marking an item's visibility, with an explanatory tooltip. */
export function VisibilityBadge({
  visibility,
  className,
}: VisibilityBadgeProps) {
  const Icon = VISIBILITY_ICONS[visibility];
  const meta = VISIBILITY_META[visibility];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn("gap-1 text-muted-foreground", className)}
          >
            <Icon aria-hidden />
            {SHORT_LABELS[visibility]}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">
          <p className="font-medium">{meta.label}</p>
          <p className="text-balance">{meta.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
