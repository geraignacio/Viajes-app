import type { MemberBalance } from "@/lib/finance/balances";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MemberLite } from "./types";

/** Vista detallada por participante: pagado, cuota, abonado, restante y saldo. */
export function MemberBalances({
  members,
  balances,
  currency,
  meId,
  footer,
}: {
  members: (MemberLite & { isGuest: boolean })[];
  balances: Map<string, MemberBalance>;
  currency: string;
  meId: string;
  footer?: React.ReactNode;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldos por persona</CardTitle>
        <CardDescription>Positivo: le deben. Negativo: debe.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {members.map((m) => {
          const b = balances.get(m.id)!;
          return (
            <div key={m.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} image={m.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.id === meId && <span className="text-muted-foreground"> (yo)</span>}
                    {m.isGuest && <span className="text-muted-foreground"> · sin cuenta</span>}
                  </p>
                  <p className="text-muted-foreground text-xs">Pagó de su bolsillo {fmt(b.paid)}</p>
                </div>
                <Badge variant={b.balance > 0 ? "positive" : b.balance < 0 ? "negative" : "secondary"} className="tabular-nums">
                  {b.balance > 0 ? "+" : ""}
                  {fmt(b.balance)}
                </Badge>
              </div>
              <Progress value={b.progress} indicatorClassName={b.remaining === 0 ? "bg-emerald-500" : undefined} />
              <p className="text-muted-foreground text-xs tabular-nums">
                Cuota asignada: {fmt(b.share)} | Abonado: {fmt(b.covered)} |{" "}
                {b.remaining > 0 ? `Restante por pagar: ${fmt(b.remaining)}` : b.owedToMe > 0 ? `Le deben: ${fmt(b.owedToMe)}` : "Al día"}
              </p>
            </div>
          );
        })}
        {footer}
      </CardContent>
    </Card>
  );
}
