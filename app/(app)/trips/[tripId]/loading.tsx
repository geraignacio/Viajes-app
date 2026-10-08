import { Skeleton } from "@/components/ui/skeleton";

// Se muestra al instante al tocar un viaje, mientras el servidor arma la página.
export default function TripLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando viaje">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
