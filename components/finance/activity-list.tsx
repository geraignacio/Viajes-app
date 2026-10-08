import { ArrowRightLeft, ExternalLink } from "lucide-react";
import type { TripDashboard } from "@/lib/trips";
import { CATEGORY_LABEL, SPLIT_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "./category-icon";
import { DeleteButton } from "./delete-button";

type Item =
  | { kind: "expense"; date: Date; createdAt: Date; e: TripDashboard["expenses"][number] }
  | { kind: "transfer"; date: Date; createdAt: Date; t: TripDashboard["transfers"][number] };

/** Gastos y abonos mezclados en orden cronológico inverso. */
export function ActivityList({
  data,
  meId,
  canModerate,
}: {
  data: TripDashboard;
  meId: string;
  canModerate: boolean;
}) {
  const { trip, expenses, transfers } = data;
  const name = new Map(trip.members.map((m) => [m.id, m.id === meId ? "Tú" : m.displayName]));
  const fmt = (n: number) => formatMoney(n, trip.currency);
  const readOnly = !!trip.archivedAt;

  const items: Item[] = [
    ...expenses.map((e) => ({ kind: "expense" as const, date: e.date, createdAt: e.createdAt, e })),
    ...transfers.map((t) => ({ kind: "transfer" as const, date: t.date, createdAt: t.createdAt, t })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no hay gastos. Registra el primero.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              if (item.kind === "expense") {
                const { e } = item;
                const myShare = e.splits.find((s) => s.memberId === meId)?.amount ?? 0;
                const payers = e.payers.map((p) => name.get(p.memberId)).join(", ");
                const canDelete = !readOnly && (canModerate || e.createdById === meId);
                return (
                  <li key={e.id} className="flex items-start gap-3 py-3">
                    <span className="bg-muted mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <CategoryIcon category={e.category} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(e.date)} · {CATEGORY_LABEL[e.category]} · pagó {payers}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {SPLIT_LABEL[e.splitType]}
                        {e.receiptNote && ` · ${e.receiptNote}`}
                        {e.receiptUrl && (
                          <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary ml-1 inline-flex items-center gap-0.5 hover:underline">
                            comprobante <ExternalLink className="size-3" />
                          </a>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{fmt(e.amount)}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">tu parte {fmt(myShare)}</p>
                    </div>
                    {canDelete && <DeleteButton kind="expense" id={e.id} label={e.title} />}
                  </li>
                );
              }
              const { t } = item;
              const canDelete = !readOnly && (canModerate || t.createdById === meId || t.fromMemberId === meId);
              return (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <ArrowRightLeft className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {name.get(t.fromMemberId)} {t.fromMemberId === meId ? "pagaste" : "pagó"} a{" "}
                      {t.toMemberId === meId ? "ti" : name.get(t.toMemberId)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(t.date)} · Abono{t.note && ` · ${t.note}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{fmt(t.amount)}</p>
                  {canDelete && <DeleteButton kind="transfer" id={t.id} label="este abono" />}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
