"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CloudOff className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">
          Something didn&apos;t load right
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          This part of the app hit a snag. Your data is safe — trying again
          usually sorts it out.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href={ROUTES.dashboard}>Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
