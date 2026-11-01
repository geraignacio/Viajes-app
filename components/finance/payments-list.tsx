import { ArrowRight } from "lucide-react";
import type { TripDashboard } from "@/lib/trips";
import { formatDate, formatMoney } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "./delete-button";

const VISIBLE = 5;

/**
 * Pagos (abonos) registrados entre integrantes, para revisarlos y borrar los
 * que se anotaron por error. Puede borrar quien pagó, quien lo anotó o el organizador.
 */
export function PaymentsList({
  data,
  meId,
  canModerate,
}: {
  data: TripDashboard;
  meId: string;
  canModerate: boolean;
}) {
  const { trip, transfers } = data;
  if (transfers.length === 0) return null;
  const name = new Map(trip.members.map((m) => [m.id, m.id === meId ? "Tú" : m.displayName]));
  const fmt = (n: number) => formatMoney(n, trip.currency);
  const readOnly = !!trip.archivedAt;
  const total = transfers.reduce((a, t) => a + t.amount, 0);

  const row = (t: TripDashboard["transfers"][number]) => {
    const from = name.get(t.fromMemberId) ?? "?";
    const to = name.get(t.toMemberId) ?? "?";
    const canDelete = !readOnly && (canModerate || t.createdById === meId || t.fromMemberId === meId);
    const recordedBy = t.createdById && t.createdById !== t.fromMemberId ? name.get(t.createdById) : null;
    return (
      <li key={t.id} className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1 text-sm font-medium">
            <span className="truncate">{from}</span>
            <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{to}</span>
          </p>
          <p className="text-muted-foreground text-xs">
            {formatDate(t.date)}
            {t.note && ` · ${t.note}`}
            {recordedBy && ` · anotado por ${recordedBy}`}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{fmt(t.amount)}</p>
        {canDelete ? (
          <DeleteButton
            kind="transfer"
            id={t.id}
            label="este pago"
            details={`${from} → ${to}: ${fmt(t.amount)} (${formatDate(t.date)})`}
          />
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos registrados</CardTitle>
        <CardDescription>
          {transfers.length} {transfers.length === 1 ? "pago" : "pagos"} por {fmt(total)}. Si alguno se anotó por error,
          bórralo con el basurero.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">{transfers.slice(0, VISIBLE).map(row)}</ul>
        {transfers.length > VISIBLE && (
          <details className="group">
            <summary className="text-primary cursor-pointer py-2 text-sm group-open:hidden">
              Ver los {transfers.length - VISIBLE} anteriores
            </summary>
            <ul className="divide-y border-t">{transfers.slice(VISIBLE).map(row)}</ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
