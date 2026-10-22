import { Scale, Wallet, Hourglass } from "lucide-react";
import type { MemberBalance } from "@/lib/finance/balances";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * Panel de métricas del viaje: Gasto total, Mi saldo y Lo que me queda por pagar
 * (con el desglose "Cuota asignada | Abonado | Restante").
 */
export function SummaryCards({
  totalSpent,
  expenseCount,
  me,
  currency,
  note,
  isFamily,
  counterparts,
}: {
  totalSpent: number;
  expenseCount: number;
  me: MemberBalance;
  currency: string;
  /** Hijos/as a cargo: "Incluye a Sofi" o "Tu deuda la paga Gerald". */
  note?: string | null;
  /** true si el saldo es el de mi familia (yo + hijos/as). */
  isFamily?: boolean;
  /** Según el cierre de cuentas: a quién le pago o quién me paga. */
  counterparts: { name: string; amount: number }[];
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  const balanceTone =
    me.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : me.balance < 0 ? "text-rose-600 dark:text-rose-400" : "";
  const owed = me.balance > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Metric icon={Wallet} title="Gasto total">
        <p className="text-2xl font-bold tabular-nums">{fmt(totalSpent)}</p>
        <p className="text-muted-foreground text-xs">
          {expenseCount} {expenseCount === 1 ? "gasto" : "gastos"} · {isFamily ? "parte de tu familia" : "tu parte"} {fmt(me.share)}
        </p>
      </Metric>

      <Metric icon={Scale} title={isFamily ? "Saldo de mi familia" : "Mi saldo"}>
        <p className={cn("text-2xl font-bold tabular-nums", balanceTone)}>
          {me.balance === 0 ? "Al día" : `${owed ? "Te deben" : "Debes"} ${fmt(Math.abs(me.balance))}`}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {isFamily ? "Pagaron" : "Pagaste"} {fmt(me.contributed)}
          {me.sent > 0 || me.received > 0 ? " (gastos y abonos)" : ""} − {isFamily ? "les" : "te"} corresponde{" "}
          {fmt(me.share)}
        </p>
        {note && <p className="text-primary text-xs">{note}</p>}
      </Metric>

      <Metric icon={Hourglass} title={owed ? "Quién me paga" : "Lo que me queda por pagar"} className="sm:col-span-2 lg:col-span-1">
        <p className="text-2xl font-bold tabular-nums">{fmt(owed ? me.owedToMe : me.remaining)}</p>
        {!owed && (
          <Progress value={me.progress} className="mt-1" indicatorClassName={me.remaining === 0 ? "bg-emerald-500" : undefined} />
        )}
        {counterparts.length > 0 ? (
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {counterparts.map((c) => (
              <li key={c.name} className="flex justify-between gap-2 tabular-nums">
                <span>{owed ? `${c.name} te paga` : `Le pagas a ${c.name}`}</span>
                <span className="text-foreground font-medium">{fmt(c.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">{me.balance === 0 ? "No debes nada ni te deben" : ""}</p>
        )}
      </Metric>
    </div>
  );
}

function Metric({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-2 py-5", className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}
