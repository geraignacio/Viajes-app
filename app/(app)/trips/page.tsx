import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { requireUser } from "@/lib/access";
import { listTripsForUser } from "@/lib/trips";
import { formatDate, formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";
import { JoinByCode } from "@/components/trips/join-by-code";

export const metadata = { title: "Mis viajes" };

type TripRow = Awaited<ReturnType<typeof listTripsForUser>>[number];

function TripCard({ trip }: { trip: TripRow }) {
  return (
    <Link href={`/trips/${trip.id}`} className="group">
      <Card className="group-hover:border-primary/50 h-full gap-3 transition-colors">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{trip.name}</CardTitle>
            <Badge variant="secondary">{trip.currency}</Badge>
          </div>
          {trip.description && <CardDescription className="line-clamp-2">{trip.description}</CardDescription>}
        </CardHeader>
        <CardContent className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {trip.startDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-4" />
              {formatDate(trip.startDate, { year: undefined })}
              {trip.endDate && ` – ${formatDate(trip.endDate)}`}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="size-4" /> {trip.memberCount}
          </span>
          <span className="text-foreground ml-auto font-medium">{formatMoney(trip.totalSpent, trip.currency)}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function TripGrid({ title, trips }: { title: string; trips: TripRow[] }) {
  if (trips.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>
    </section>
  );
}

export default async function TripsPage() {
  const user = await requireUser();
  const trips = await listTripsForUser(user.id);
  const active = trips.filter((t) => t.status === "active");
  const past = trips.filter((t) => t.status === "past");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Mis viajes</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <JoinByCode />
          <CreateTripDialog />
        </div>
      </div>
      {trips.length === 0 ? (
        <Card className="items-center py-12 text-center">
          <CardContent className="text-muted-foreground space-y-1">
            <p className="text-foreground font-medium">Aún no tienes viajes</p>
            <p>Crea uno o únete con el código que te compartieron.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <TripGrid title="Activos" trips={active} />
          <TripGrid title="Pasados" trips={past} />
        </>
      )}
    </div>
  );
}
