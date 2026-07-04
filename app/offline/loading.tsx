import { Skeleton } from "@/components/ui/skeleton";

export default function OfflineLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <Skeleton className="size-12 rounded-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-32 rounded-md" />
    </div>
  );
}
