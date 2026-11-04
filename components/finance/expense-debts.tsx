"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { settleExpenseDebt } from "@/server-actions/transfers";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ExpenseDebtRow = {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  amount: number;
  paid: number;
  remaining: number;
  /** Quien debe ya no tiene deuda en el viaje (pagó con abonos generales). */
  coveredByGeneral: boolean;
  /** Si quien mira puede registrar este pago (es quien debe, a quien le deben, o lo representa). */
  canSettle: boolean;
};

/** "Deudas de este gasto": quién le debe cuánto a quién, con botón Saldar. */
export function ExpenseDebts({
  expenseId,
  title,
  currency,
  debts,
  readOnly,
}: {
  expenseId: string;
  title: string;
  currency: string;
  debts: ExpenseDebtRow[];
  readOnly: boolean;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  return (
    <ul className="mt-2 space-y-1.5">
      {debts.map((d) => {
        const done = d.remaining === 0 || d.coveredByGeneral;
        return (
          <li
            key={`${d.from}-${d.to}`}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1.5 text-xs ${done ? "bg-muted/40" : "border-amber-500/40 bg-amber-500/5"}`}
          >
            <span className="min-w-0 flex-1">
              <b className="font-medium">{d.fromName}</b> {d.fromName === "Tú" ? "le debes" : "le debe"} a{" "}
              <b className="font-medium">{d.toName === "Tú" ? "ti" : d.toName}</b>
            </span>
            {done ? (
              <span
                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                title={d.remaining === 0 ? undefined : "Ya no debe nada en el viaje: se compensó con otros gastos o pagos"}
              >
                <CheckCircle2 className="size-3.5" />
                <span className="tabular-nums line-through opacity-70">{fmt(d.amount)}</span>
                {d.remaining === 0 ? "Saldado" : "Compensado"}
              </span>
            ) : (
              <>
                <span className="font-semibold tabular-nums">
                  {fmt(d.remaining)}
                  {d.paid > 0 && <span className="text-muted-foreground font-normal"> de {fmt(d.amount)}</span>}
                </span>
                {!readOnly && d.canSettle && <SettleButton expenseId={expenseId} title={title} debt={d} fmt={fmt} />}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SettleButton({
  expenseId,
  title,
  debt,
  fmt,
}: {
  expenseId: string;
  title: string;
  debt: ExpenseDebtRow;
  fmt: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const to = debt.toName === "Tú" ? "ti" : debt.toName;

  const settle = () =>
    startTransition(async () => {
      const res = await settleExpenseDebt({ expenseId, fromMemberId: debt.from, toMemberId: debt.to });
      if (res.ok) {
        setOpen(false);
        toast.success(`Saldado: ${fmt(res.data.amount)} de ${title}`);
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
          <HandCoins className="size-3.5" /> Saldar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Saldar la deuda de {title}?</DialogTitle>
          <DialogDescription>
            Se registra un pago de <b>{fmt(debt.remaining)}</b> de {debt.fromName === "Tú" ? "ti" : debt.fromName} a {to}{" "}
            por este gasto. Hazlo cuando el dinero ya se haya transferido. Los saldos se recalculan y, si te equivocas,
            puedes borrar el pago en &quot;Pagos registrados&quot;.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={settle} disabled={pending}>
            <HandCoins /> {pending ? "Guardando…" : "Saldar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
