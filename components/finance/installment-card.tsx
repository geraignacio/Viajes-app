"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CheckCircle2, Circle, CircleDot, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { deleteInstallmentPlan, saveInstallmentPlan } from "@/server-actions/installments";
import { installmentStatus, splitInstallments } from "@/lib/finance/installments";
import { INSTALLMENT_OPTIONS } from "@/lib/validation/installment";
import { formatDate, formatMoney, todayISO } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { RecordDialog } from "./record-dialog";
import type { MemberLite } from "./types";

export type PlanData = { installments: number; baseAmount: number; baseContributed: number; firstDueDate: string };

type Props = {
  tripId: string;
  currency: string;
  members: MemberLite[];
  meId: string;
  /** Lo que me queda por pagar hoy (unidades mínimas). */
  remaining: number;
  /** Lo aportado hoy (pagado + enviado - recibido). */
  contributed: number;
  plan: PlanData | null;
  /** A quién le pago según el cierre de cuentas (el mayor acreedor). */
  payToId: string | null;
};

/** "Voy a pagar mi deuda en N cuotas": arma el plan y muestra el avance. */
export function InstallmentCard({ tripId, currency, members, meId, remaining, contributed, plan, payToId }: Props) {
  const fmt = (n: number) => formatMoney(n, currency);
  const [pending, startTransition] = useTransition();
  const [n, setN] = useState(plan?.installments ?? 6);
  const [first, setFirst] = useState(plan?.firstDueDate ?? todayISO());
  const [editing, setEditing] = useState(false);

  function save(installments = n, firstDueDate = first) {
    startTransition(async () => {
      const res = await saveInstallmentPlan({ tripId, memberId: meId, installments, firstDueDate });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Plan creado: ${installments} cuotas`);
      setEditing(false);
    });
  }

  function remove() {
    if (!confirm("¿Eliminar tu plan de cuotas? Tu deuda no cambia.")) return;
    startTransition(async () => {
      const res = await deleteInstallmentPlan({ tripId, memberId: meId });
      if (!res.ok) toast.error(res.error);
    });
  }

  // Sin plan (o editándolo): formulario con vista previa en vivo.
  if (!plan || editing) {
    const parts = remaining > 0 ? splitInstallments(remaining, n) : [];
    return (
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="text-primary size-5" /> Pagar en cuotas
          </CardTitle>
          <CardDescription>Divide lo que te queda por pagar ({fmt(remaining)}) en cuotas mensuales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="inst-n">Número de cuotas</Label>
              <NativeSelect id="inst-n" value={n} onChange={(e) => setN(Number(e.target.value))}>
                {INSTALLMENT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o} cuotas
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-first">Primera cuota</Label>
              <Input id="inst-first" type="date" value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
          </div>
          {parts.length > 0 && (
            <div className="bg-muted/60 rounded-lg p-3 text-center">
              <p className="text-muted-foreground text-xs">Pagarías</p>
              <p className="text-2xl font-bold tabular-nums">
                {n} × {fmt(parts[0])}
              </p>
              {parts[0] !== parts[parts.length - 1] && (
                <p className="text-muted-foreground text-xs">
                  (las últimas de {fmt(parts[parts.length - 1])} por redondeo)
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={pending || remaining <= 0} onClick={() => save()}>
              {pending ? "Guardando…" : plan ? "Guardar cambios" : "Crear plan"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = installmentStatus(plan, { remaining, contributed });
  // Al actualizar, lo que falta se reparte en las cuotas que quedaban, desde la próxima.
  const left = Math.max(2, plan.installments - status.paidCount);
  const nextAmount = status.next ? Math.min(remaining, status.next.amount - Math.round(status.next.covered * status.next.amount)) : 0;

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="text-primary size-5" /> Mi plan en {plan.installments} cuotas
            </CardTitle>
            <CardDescription>
              {status.completed
                ? "¡Plan completado! 🎉"
                : `${status.paidCount} de ${plan.installments} pagadas · cuotas de ${fmt(status.perInstallment)}`}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Editar plan" onClick={() => setEditing(true)}>
              <RefreshCw />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Eliminar plan" disabled={pending} onClick={remove}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={status.paidSinceStart / plan.baseAmount} />

        {status.outdated && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <span className="flex-1">
              Tu deuda subió a {fmt(remaining)} por gastos nuevos. Actualiza el plan para repartirla en tus {left} cuotas restantes.
            </span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => save(left, status.next?.dueDate ?? plan.firstDueDate)}>
              Actualizar plan
            </Button>
          </div>
        )}

        <ol className="divide-y rounded-lg border">
          {status.schedule.map((s) => (
            <li key={s.n} className={cn("flex items-center gap-3 px-3 py-2 text-sm", s.status === "next" && "bg-primary/5")}>
              {s.status === "paid" ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : s.status === "next" ? (
                <CircleDot className="text-primary size-4" />
              ) : (
                <Circle className="text-muted-foreground size-4" />
              )}
              <span className={cn("w-16", s.status === "paid" && "text-muted-foreground line-through")}>Cuota {s.n}</span>
              <span className="text-muted-foreground flex-1 text-xs">vence {formatDate(s.dueDate)}</span>
              {s.status === "next" && s.covered > 0 && (
                <span className="text-muted-foreground text-xs">{Math.round(s.covered * 100)}%</span>
              )}
              <span className="font-medium tabular-nums">{fmt(s.amount)}</span>
            </li>
          ))}
        </ol>

        {!status.completed && payToId && nextAmount > 0 && (
          <RecordDialog
            tripId={tripId}
            currency={currency}
            members={members}
            meId={meId}
            defaultTab="transfer"
            transferPreset={{ fromMemberId: meId, toMemberId: payToId, amount: nextAmount }}
            trigger={<Button className="w-full">Registrar pago de la cuota {status.next?.n}</Button>}
          />
        )}
      </CardContent>
    </Card>
  );
}
