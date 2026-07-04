import Link from "next/link";
import { Compass } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Compass className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">
          We couldn&apos;t find that page
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for may have moved or never existed.
          Let&apos;s get you back to your plan.
        </p>
      </div>
      <Button asChild>
        <Link href={ROUTES.dashboard}>Go to dashboard</Link>
      </Button>
    </div>
  );
}
