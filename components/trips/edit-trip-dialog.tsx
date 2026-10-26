"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateTrip } from "@/server-actions/trips";
import type { FieldErrors } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/field-error";

type Props = {
  trip: { id: string; name: string; description: string | null; startDate: string | null; endDate: string | null };
};

export function EditTripDialog({ trip }: Props) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(form: FormData) {
    const get = (k: string) => String(form.get(k) ?? "");
    startTransition(async () => {
      const res = await updateTrip({
        tripId: trip.id,
        name: get("name"),
        description: get("description"),
        startDate: get("startDate"),
        endDate: get("endDate"),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setOpen(false);
      toast.success("Viaje actualizado");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar viaje</DialogTitle>
          <DialogDescription>La moneda no se puede cambiar porque los montos ya están en ella.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input id="edit-name" name="name" defaultValue={trip.name} required aria-invalid={!!errors.name} />
            <FieldError errors={errors.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea id="edit-description" name="description" defaultValue={trip.description ?? ""} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-startDate">Desde</Label>
              <Input id="edit-startDate" name="startDate" type="date" defaultValue={trip.startDate ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-endDate">Hasta</Label>
              <Input
                id="edit-endDate"
                name="endDate"
                type="date"
                defaultValue={trip.endDate ?? ""}
                aria-invalid={!!errors.endDate}
              />
            </div>
          </div>
          <FieldError errors={errors.endDate} />
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
