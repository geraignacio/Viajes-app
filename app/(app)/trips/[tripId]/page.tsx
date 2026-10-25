import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, Landmark, Plus } from "lucide-react";
import { requireUser } from "@/lib/access";
import { getTripDashboard } from "@/lib/trips";
import { formatDate } from "@/lib/money";
import { canActFor } from "@/lib/permissions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityList } from "@/components/finance/activity-list";
import { MemberBalances } from "@/components/finance/member-balances";
import { RecordDialog } from "@/components/finance/record-dialog";
import { SettlementList } from "@/components/finance/settlement-list";
import { SummaryCards } from "@/components/finance/summary-cards";
import { SpendingCharts } from "@/components/finance/spending-charts";
import { InstallmentCard } from "@/components/finance/installment-card";
import { AddGuestForm } from "@/components/trips/add-guest-form";
import { ExportMenu } from "@/components/trips/export-menu";
import { InviteCard } from "@/components/trips/invite-card";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser(`/trips/${tripId}`);

  // Todo en paralelo; el acceso se valida con los integrantes ya cargados.
  const data = await getTripDashboard(tripId);
  if (!data) notFound();
  const { trip, balanceById, familyBalanceById, headOf, settlement, totalSpent, expenses } = data;
  const me = trip.members.find((m) => m.userId === user.id);
  if (!me || me.leftAt) notFound();
  const readOnly = !!trip.archivedAt;
  const canModerate = me.role !== "MEMBER";

  const allMembers = trip.members.map((m) => ({
    id: m.id,
    name: m.displayName,
    image: m.user?.image,
    payment: m.user?.paymentInfo
      ? (({ userId: _u, updatedAt: _t, ...rest }) => rest)(m.user.paymentInfo)
      : null,
    isGuest: !m.userId,
    canActFor: canActFor(me, m),
    isOwner: m.role === "OWNER",
    parentId: m.parentMemberId,
    active: !m.leftAt,
    planSummary: m.installmentPlan
      ? {
          installments: m.installmentPlan.installments,
          baseAmount: m.installmentPlan.baseAmount,
          baseContributed: m.installmentPlan.baseContributed,
          firstDueDate: m.installmentPlan.firstDueDate.toISOString().slice(0, 10),
        }
      : null,
  }));
  // Si tengo hijos/as a cargo, mi deuda incluye la de ellos; si soy hijo/a, la paga mi padre/madre.
  const myHead = headOf.get(me.id) ?? me.id;
  const myKids = trip.members.filter((m) => m.id !== me.id && headOf.get(m.id) === me.id).map((m) => m.displayName);
  const myBalance = myHead === me.id ? familyBalanceById.get(me.id)! : balanceById.get(me.id)!;
  // "Diana Aravena (con Matias)": quien paga por la familia y sus hijos/as.
  const familyName = (headId: string) => {
    const head = trip.members.find((m) => m.id === headId);
    const kids = trip.members.filter((m) => m.id !== headId && headOf.get(m.id) === headId).map((m) => m.displayName);
    return kids.length ? `${head?.displayName} (con ${kids.join(" y ")})` : (head?.displayName ?? "");
  };
  const familyNote =
    myHead !== me.id
      ? `Tu deuda la paga ${trip.members.find((m) => m.id === myHead)?.displayName}`
      : myKids.length > 0
        ? `Incluye a ${myKids.join(", ")}`
        : null;
  const myPlan = allMembers.find((m) => m.id === me.id)?.planSummary ?? null;
  // A quién le pago mis cuotas: mi mayor acreedor según el cierre de cuentas.
  const payToId = settlement.filter((s) => s.from === me.id).sort((a, b) => b.amount - a.amount)[0]?.to ?? null;
  // Quien salió del viaje (con saldo en cero) solo queda en el historial.
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
          <Button asChild variant="outline" size="sm">
            <Link href={`/trips/${trip.id}/photos`}>
              <Camera /> Fotos
            </Link>
          </Button>
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

      <SummaryCards
        totalSpent={totalSpent}
        expenseCount={expenses.length}
        me={myBalance}
        currency={trip.currency}
        note={familyNote}
        isFamily={myHead === me.id && myKids.length > 0}
        counterparts={settlement
          .filter(() => myHead === me.id)
          .filter((x) => x.from === myHead || x.to === myHead)
          .map((x) => ({ name: familyName(x.from === myHead ? x.to : x.from), amount: x.amount }))}
      />

      {!readOnly && myBalance.owedToMe > 0 && !allMembers.find((m) => m.id === me.id)?.payment && (
        <Link
          href="/profile"
          className="border-primary/40 bg-primary/5 hover:bg-primary/10 flex items-center gap-3 rounded-xl border p-4 text-sm transition-colors"
        >
          <Landmark className="text-primary size-5 shrink-0" />
          <span>
            Te deben dinero. <b>Agrega tus datos de transferencia</b> para que el grupo sepa dónde pagarte.
          </span>
        </Link>
      )}

      {!readOnly && myHead === me.id && (myBalance.remaining > 0 || myPlan) && (
        <InstallmentCard
          tripId={trip.id}
          currency={trip.currency}
          members={activeMembers}
          meId={me.id}
          remaining={myBalance.remaining}
          contributed={myBalance.contributed}
          plan={myPlan}
          payToId={payToId}
        />
      )}

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
          <SpendingCharts
            currency={trip.currency}
            points={expenses.map((e) => ({
              category: e.category,
              date: e.date.toISOString().slice(0, 10),
              amount: e.amount,
              myShare: e.splits.find((s) => s.memberId === me.id)?.amount ?? 0,
            }))}
          />
          <ActivityList data={data} meId={me.id} canModerate={canModerate} />
        </div>
        <div className="min-w-0 space-y-6">
          <MemberBalances
            tripId={trip.id}
            members={activeMembers}
            balances={balanceById}
            familyBalances={familyBalanceById}
            currency={trip.currency}
            meId={me.id}
            canModerate={canModerate}
            readOnly={readOnly}
            footer={!readOnly && <AddGuestForm tripId={trip.id} />}
          />
          {!readOnly && <InviteCard tripId={trip.id} code={trip.inviteCode} canRegenerate={canModerate} />}
        </div>
      </div>
    </div>
  );
}
