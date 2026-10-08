"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense } from "@/server-actions/expenses";
import { deleteTransfer } from "@/server-actions/transfers";
import { Button } from "@/components/ui/button";

export function DeleteButton({ kind, id, label }: { kind: "expense" | "transfer"; id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-destructive size-8"
      aria-label={`Eliminar ${label}`}
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Eliminar "${label}"? Los saldos se recalcularán.`)) return;
        startTransition(async () => {
          const res = kind === "expense" ? await deleteExpense({ id }) : await deleteTransfer({ id });
          if (res.ok) toast.success("Eliminado");
          else toast.error(res.error);
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}
