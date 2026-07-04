import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          TogetherWealth needs a connection to load your latest numbers.
          Everything is saved — it will all be here once you&apos;re back
          online.
        </p>
      </div>
      <Button asChild>
        <a href={ROUTES.dashboard}>Try again</a>
      </Button>
    </div>
  );
}
