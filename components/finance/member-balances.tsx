import type { MemberBalance } from "@/lib/finance/balances";
import { installmentStatus } from "@/lib/finance/installments";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MemberActions } from "./member-actions";
import type { MemberLite } from "./types";

type Row = MemberLite & {
  isGuest: boolean;
  isOwner: boolean;
  parentId: string | null;
  planSummary?: { installments: number; baseAmount: number; baseContributed: number; firstDueDate: string } | null;
};

/**
 * Vista detallada por participante: pagado, cuota, abonado, restante y saldo.
 * Los hijos/as aparecen bajo su padre/madre, con el total de la familia.
 */
export function MemberBalances({
  tripId,
  members,
  balances,
  familyBalances,
  currency,
  meId,
  canModerate,
  readOnly,
  footer,
}: {
  tripId: string;
  members: Row[];
  balances: Map<string, MemberBalance>;
  /** Saldo combinado (propio + hijos/as) por cabeza de familia. */
  familyBalances: Map<string, MemberBalance>;
  currency: string;
  meId: string;
  canModerate: boolean;
  readOnly?: boolean;
  footer?: React.ReactNode;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  const ids = new Set(members.map((m) => m.id));
  const parentOf = (m: Row) => (m.parentId && ids.has(m.parentId) ? m.parentId : null);
  const childrenOf = (id: string) => members.filter((c) => parentOf(c) === id);
  // Cabezas de familia en su orden, cada una seguida de sus hijos/as.
  const ordered = members.filter((m) => !parentOf(m)).flatMap((m) => [m, ...childrenOf(m.id)]);
  const parentOptions = members.filter((m) => !parentOf(m)).map((m) => ({ id: m.id, name: m.name }));
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldos por persona</CardTitle>
        <CardDescription>Positivo: le deben. Negativo: debe.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {ordered.map((m) => {
          const b = balances.get(m.id)!;
          const parentId = parentOf(m);
          const kids = parentId ? [] : childrenOf(m.id);
          const fam = kids.length > 0 ? familyBalances.get(m.id) : undefined;
          const plan = m.planSummary ? installmentStatus(m.planSummary, familyBalances.get(m.id) ?? b) : null;
          const canEdit = !readOnly && (canModerate || m.id === meId || m.isGuest || parentId === meId);
          return (
            <div key={m.id} className={cn("space-y-2", parentId && "border-muted ml-4 border-l-2 pl-3")}>
              <div className="flex items-center gap-3">
                <Avatar name={m.name} image={m.image} className={parentId ? "size-7" : undefined} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.id === meId && <span className="text-muted-foreground"> (yo)</span>}
                    {m.isGuest && <span className="text-muted-foreground"> · sin cuenta</span>}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {parentId ? `Hijo/a a cargo de ${nameOf.get(parentId)} · ` : ""}Pagó {fmt(b.paid)}
                  </p>
                </div>
                <Badge variant={b.balance > 0 ? "positive" : b.balance < 0 ? "negative" : "secondary"} className="tabular-nums">
                  {b.balance > 0 ? "+" : ""}
                  {fmt(b.balance)}
                </Badge>
                {canEdit && (
                  <MemberActions
                    tripId={tripId}
                    member={{ id: m.id, name: m.name, parentId }}
                    isMe={m.id === meId}
                    canRemove={!m.isOwner}
                    hasChildren={kids.length > 0}
                    parentOptions={parentOptions}
                  />
                )}
              </div>
              <Progress value={b.progress} indicatorClassName={b.remaining === 0 ? "bg-emerald-500" : undefined} />
              <p className="text-muted-foreground text-xs tabular-nums">
                Cuota asignada: {fmt(b.share)} | Abonado: {fmt(b.covered)} |{" "}
                {b.remaining > 0 ? `Restante por pagar: ${fmt(b.remaining)}` : b.owedToMe > 0 ? `Le deben: ${fmt(b.owedToMe)}` : "Al día"}
              </p>
              {fam && (
                <p className="bg-muted/60 rounded-md px-2 py-1 text-xs tabular-nums">
                  Con {kids.map((k) => k.name).join(", ")}:{" "}
                  <b>
                    {fam.remaining > 0
                      ? `debe ${fmt(fam.remaining)}`
                      : fam.owedToMe > 0
                        ? `le deben ${fmt(fam.owedToMe)}`
                        : "al día"}
                  </b>{" "}
                  (cuota familiar {fmt(fam.share)})
                </p>
              )}
              {plan && m.planSummary && (
                <p className="text-primary text-xs">
                  Plan en {m.planSummary.installments} cuotas de {fmt(plan.perInstallment)} ·{" "}
                  {plan.completed ? "completado" : `${plan.paidCount}/${m.planSummary.installments} pagadas`}
                </p>
              )}
            </div>
          );
        })}
        {footer}
      </CardContent>
    </Card>
  );
}
