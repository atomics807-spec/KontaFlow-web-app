import { Skeleton, SkeletonCard, SkeletonChart, SkeletonTable, SkeletonText } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="surface p-5 sm:p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-52" />
          <SkeletonChart className="mt-6" />
        </div>
        <div className="surface p-5 sm:p-6">
          <Skeleton className="h-4 w-28" />
          <SkeletonText lines={5} className="mt-6" />
        </div>
      </div>
      <SkeletonTable />
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <SkeletonTable rows={7} />
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5" aria-busy="true">
      <Skeleton className="h-7 w-48" />
      <div className="surface space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
    </div>
  );
}
