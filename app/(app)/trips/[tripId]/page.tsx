import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireUser } from "@/lib/access";
import { getTripDashboard } from "@/lib/trips";
import { formatDate } from "@/lib/money";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityList } from "@/components/finance/activity-list";
import { MemberBalances } from "@/components/finance/member-balances";
import { RecordDialog } from "@/components/finance/record-dialog";
import { SettlementList } from "@/components/finance/settlement-list";
import { SummaryCards } from "@/components/finance/summary-cards";
import { AddGuestForm } from "@/components/trips/add-guest-form";
import { ExportMenu } from "@/components/trips/export-menu";
import { InviteCard } from "@/components/trips/invite-card";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser(`/trips/${tripId}`);

  // Todo en paralelo; el acceso se valida con los integrantes ya cargados.
  const data = await getTripDashboard(tripId);
  if (!data) notFound();
  const { trip, balanceById, settlement, totalSpent, expenses } = data;
  const me = trip.members.find((m) => m.userId === user.id);
  if (!me || me.leftAt) notFound();
  const readOnly = !!trip.archivedAt;
  const canModerate = me.role !== "MEMBER";

  const allMembers = trip.members.map((m) => ({
    id: m.id,
    name: m.displayName,
    image: m.user?.image,
    isGuest: !m.userId,
    active: !m.leftAt,
  }));
  // En formularios solo integrantes activos; en saldos, todos (incluye quien salió).
  const activeMembers = allMembers.filter((m) => m.active);

  return (
    <div className="space-y-6">
      {!readOnly && <AutoRefresh />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link href="/trips" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="size-4" /> Viajes
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {trip.startDate && (
              <span>
                {formatDate(trip.startDate)}
                {trip.endDate && ` – ${formatDate(trip.endDate)}`}
              </span>
            )}
            <Badge variant="secondary">{trip.currency}</Badge>
            {readOnly && <Badge variant="outline">Cerrado</Badge>}
          </p>
          {trip.description && <p className="text-muted-foreground max-w-prose text-sm">{trip.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu tripId={trip.id} />
          {!readOnly && (
            <RecordDialog
              tripId={trip.id}
              currency={trip.currency}
              members={activeMembers}
              meId={me.id}
              trigger={
                <Button size="sm">
                  <Plus /> Registrar
                </Button>
              }
            />
          )}
        </div>
      </div>

      <SummaryCards totalSpent={totalSpent} expenseCount={expenses.length} me={balanceById.get(me.id)!} currency={trip.currency} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <SettlementList
            settlement={settlement}
            members={allMembers}
            tripId={trip.id}
            currency={trip.currency}
            meId={me.id}
            readOnly={readOnly}
          />
          <ActivityList data={data} meId={me.id} canModerate={canModerate} />
        </div>
        <div className="space-y-6">
          <MemberBalances
            members={allMembers}
            balances={balanceById}
            currency={trip.currency}
            meId={me.id}
            footer={!readOnly && <AddGuestForm tripId={trip.id} />}
          />
          {!readOnly && <InviteCard tripId={trip.id} code={trip.inviteCode} canRegenerate={canModerate} />}
        </div>
      </div>
    </div>
  );
}
