import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Settlement } from "@/lib/finance/settlement";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordDialog } from "./record-dialog";
import type { MemberLite } from "./types";

/** Cierre de cuentas: transferencias mínimas para dejar todo en cero. */
export function SettlementList({
  settlement,
  members,
  tripId,
  currency,
  meId,
  readOnly,
}: {
  settlement: Settlement[];
  members: MemberLite[];
  tripId: string;
  currency: string;
  meId: string;
  readOnly?: boolean;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cierre de cuentas</CardTitle>
        <CardDescription>
          {settlement.length === 0
            ? "Nadie le debe nada a nadie."
            : `${settlement.length} ${settlement.length === 1 ? "transferencia" : "transferencias"} para dejar todo en cero.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settlement.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-500" /> Cuentas saldadas
          </div>
        ) : (
          <ul className="space-y-3">
            {settlement.map((s) => {
              const from = byId.get(s.from)!;
              const to = byId.get(s.to)!;
              const involvesMe = s.from === meId || s.to === meId;
              return (
                <li key={`${s.from}-${s.to}`} className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${involvesMe ? "border-primary/40 bg-primary/5" : ""}`}>
                  <Avatar name={from.name} image={from.image} className="size-7" />
                  <span className="text-sm font-medium">{s.from === meId ? "Tú" : from.name}</span>
                  <ArrowRight className="text-muted-foreground size-4" />
                  <Avatar name={to.name} image={to.image} className="size-7" />
                  <span className="text-sm font-medium">{s.to === meId ? "a ti" : to.name}</span>
                  <span className="ml-auto font-semibold tabular-nums">{formatMoney(s.amount, currency)}</span>
                  {!readOnly && (
                    <RecordDialog
                      tripId={tripId}
                      currency={currency}
                      members={members}
                      meId={meId}
                      defaultTab="transfer"
                      transferPreset={{ fromMemberId: s.from, toMemberId: s.to, amount: s.amount }}
                      trigger={
                        <Button size="sm" variant="outline" className="w-full sm:w-auto">
                          Registrar pago
                        </Button>
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
