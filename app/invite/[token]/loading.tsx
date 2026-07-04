import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function InviteLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-2 h-11 w-full max-w-xs" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
