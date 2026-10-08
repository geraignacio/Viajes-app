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
}: {
  totalSpent: number;
  expenseCount: number;
  me: MemberBalance;
  currency: string;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  const balanceTone =
    me.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : me.balance < 0 ? "text-rose-600 dark:text-rose-400" : "";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Metric icon={Wallet} title="Gasto total">
        <p className="text-2xl font-bold tabular-nums">{fmt(totalSpent)}</p>
        <p className="text-muted-foreground text-xs">
          {expenseCount} {expenseCount === 1 ? "gasto" : "gastos"} · tu parte {fmt(me.share)}
        </p>
      </Metric>

      <Metric icon={Scale} title="Mi saldo">
        <p className={cn("text-2xl font-bold tabular-nums", balanceTone)}>
          {me.balance > 0 ? "+" : ""}
          {fmt(me.balance)}
        </p>
        <p className="text-muted-foreground text-xs">
          {me.balance > 0 ? "Te deben dinero" : me.balance < 0 ? "Debes dinero al grupo" : "Estás al día"}
          {" · pagaste "}
          {fmt(me.paid)}
        </p>
      </Metric>

      <Metric icon={Hourglass} title="Lo que me queda por pagar" className="sm:col-span-2 lg:col-span-1">
        <p className="text-2xl font-bold tabular-nums">{fmt(me.remaining)}</p>
        <Progress value={me.progress} className="mt-1" indicatorClassName={me.remaining === 0 ? "bg-emerald-500" : undefined} />
        <dl className="text-muted-foreground mt-1 grid grid-cols-3 gap-1 text-xs">
          <div>
            <dt>Cuota asignada</dt>
            <dd className="text-foreground font-medium tabular-nums">{fmt(me.share)}</dd>
          </div>
          <div>
            <dt>Abonado</dt>
            <dd className="text-foreground font-medium tabular-nums">{fmt(me.covered)}</dd>
          </div>
          <div>
            <dt>Restante</dt>
            <dd className="text-foreground font-medium tabular-nums">{fmt(me.remaining)}</dd>
          </div>
        </dl>
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
