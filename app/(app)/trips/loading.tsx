import { Skeleton } from "@/components/ui/skeleton";

export default function TripsLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando viajes">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
