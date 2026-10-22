import type { MemberBalance } from "@/lib/finance/balances";
import { installmentStatus } from "@/lib/finance/installments";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
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
 * Saldos agrupados por familia: quien no tiene hijos/as a cargo es una familia
 * de una persona. Cada tarjeta muestra el resultado en palabras ("Le deben",
 * "Debe") y el cálculo que lo explica; el detalle por persona va debajo.
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
  const heads = members.filter((m) => !parentOf(m));
  const childrenOf = (id: string) => members.filter((c) => parentOf(c) === id);
  const parentOptions = heads.map((m) => ({ id: m.id, name: m.name }));
  const hasFamilies = members.some((m) => parentOf(m));

  const label = (m: Row) => (
    <>
      {m.name}
      {m.id === meId && <span className="text-muted-foreground font-normal"> (yo)</span>}
      {m.isGuest && <span className="text-muted-foreground font-normal"> · sin cuenta</span>}
    </>
  );
  const actions = (m: Row, parentId: string | null, hasChildren: boolean) =>
    !readOnly &&
    (canModerate || m.id === meId || m.isGuest || parentId === meId) && (
      <MemberActions
        tripId={tripId}
        member={{ id: m.id, name: m.name, parentId }}
        isMe={m.id === meId}
        canRemove={!m.isOwner}
        hasChildren={hasChildren}
        parentOptions={parentOptions}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasFamilies ? "Saldos por familia" : "Saldos por persona"}</CardTitle>
        <CardDescription>
          {hasFamilies
            ? "Los hijos/as a cargo suman su parte a la de su padre o madre, que paga por ellos."
            : "Lo que pagó cada uno comparado con lo que le corresponde."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {heads.map((head) => {
          const kids = childrenOf(head.id);
          const fam = familyBalances.get(head.id) ?? balances.get(head.id)!;
          const people = [head, ...kids];
          const plan = head.planSummary ? installmentStatus(head.planSummary, fam) : null;
          return (
            <div key={head.id} className={cn("space-y-3 rounded-lg border p-3", head.id === meId && "border-primary/40 bg-primary/5")}>
              <div className="flex items-center gap-3">
                <Avatar name={head.name} image={head.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label(head)}</p>
                  {kids.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Paga también por {kids.map((k) => k.name).join(" y ")}
                    </p>
                  )}
                </div>
                {actions(head, null, kids.length > 0)}
              </div>

              <Progress value={fam.progress} indicatorClassName={fam.remaining === 0 ? "bg-emerald-500" : undefined} />

              {/* El cálculo, en palabras: pagado + abonos − lo que corresponde = resultado */}
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs tabular-nums [&>*:nth-last-child(-n+2)]:text-sm">
                <dt className="text-muted-foreground">{kids.length ? "Pagaron en gastos" : "Pagó en gastos"}</dt>
                <dd className="text-right">{fmt(fam.paid)}</dd>
                {fam.sent > 0 && (
                  <>
                    <dt className="text-muted-foreground">Abonos enviados</dt>
                    <dd className="text-right">+ {fmt(fam.sent)}</dd>
                  </>
                )}
                {fam.received > 0 && (
                  <>
                    <dt className="text-muted-foreground">Abonos recibidos</dt>
                    <dd className="text-right">− {fmt(fam.received)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">
                  {kids.length ? `Les corresponde (${people.length} personas)` : "Le corresponde"}
                </dt>
                <dd className="text-right">− {fmt(fam.share)}</dd>
                <dt className={cn("border-t pt-1 font-medium", tone(fam))}>{resultText(fam)}</dt>
                <dd className={cn("border-t pt-1 text-right font-semibold", tone(fam))}>
                  {fam.balance === 0 ? "—" : fmt(Math.abs(fam.balance))}
                </dd>
              </dl>

              {kids.length > 0 && (
                <ul className="space-y-1.5 border-t pt-2">
                  {people.map((p) => {
                    const b = balances.get(p.id)!;
                    return (
                      <li key={p.id} className="flex items-center gap-2 text-xs">
                        <Avatar name={p.name} image={p.image} className="size-6 text-[10px]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{label(p)}</p>
                          <p className="text-muted-foreground tabular-nums">
                            Su parte {fmt(b.share)} · pagó {fmt(b.paid)}
                          </p>
                        </div>
                        {p.id !== head.id && actions(p, head.id, false)}
                      </li>
                    );
                  })}
                </ul>
              )}

              {plan && head.planSummary && (
                <p className="text-primary text-xs">
                  Plan en {head.planSummary.installments} cuotas de {fmt(plan.perInstallment)} ·{" "}
                  {plan.completed ? "completado" : `${plan.paidCount}/${head.planSummary.installments} pagadas`}
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

function resultText(b: MemberBalance) {
  if (b.balance > 0) return "Le deben";
  if (b.balance < 0) return "Debe";
  return "Al día";
}

const tone = (b: MemberBalance) =>
  b.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : b.balance < 0 ? "text-rose-600 dark:text-rose-400" : "";
