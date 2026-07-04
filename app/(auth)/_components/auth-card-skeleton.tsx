import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading skeleton mirroring the centered auth card
 * (title + description + a couple of fields + submit button).
 */
export function AuthCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader className="items-center">
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="mx-auto mt-2 h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}
