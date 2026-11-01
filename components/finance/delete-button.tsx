"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense, restoreExpense } from "@/server-actions/expenses";
import { deleteTransfer, restoreTransfer } from "@/server-actions/transfers";
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

/**
 * Botón de basurero con confirmación. El borrado se puede deshacer desde el
 * aviso que aparece después (el registro queda oculto, no se pierde).
 */
export function DeleteButton({
  kind,
  id,
  label,
  details,
}: {
  kind: "expense" | "transfer";
  id: string;
  label: string;
  /** Resumen de lo que se va a borrar (p. ej. "Ana pagó $20.000 a Luis · 3 nov"). */
  details?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const noun = kind === "expense" ? "gasto" : "pago";

  const undo = () =>
    startTransition(async () => {
      const res = kind === "expense" ? await restoreExpense({ id }) : await restoreTransfer({ id });
      if (res.ok) toast.success(kind === "expense" ? "Gasto recuperado" : "Pago recuperado");
      else toast.error(res.error);
    });

  const remove = () =>
    startTransition(async () => {
      const res = kind === "expense" ? await deleteExpense({ id }) : await deleteTransfer({ id });
      if (res.ok) {
        setOpen(false);
        toast.success(kind === "expense" ? "Gasto eliminado" : "Pago eliminado", {
          duration: 10_000,
          action: { label: "Deshacer", onClick: undo },
        });
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
          aria-label={`Eliminar ${label}`}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este {noun}?</DialogTitle>
          <DialogDescription>
            {details ?? label}
            <br />
            Los saldos se recalcularán. Si te equivocas, puedes deshacerlo justo después.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={remove} disabled={pending}>
            <Trash2 /> {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
