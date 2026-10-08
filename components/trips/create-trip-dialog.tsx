"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTrip } from "@/server-actions/trips";
import { CURRENCIES } from "@/lib/constants";
import type { FieldErrors } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/field-error";

export function CreateTripDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(form: FormData) {
    const get = (k: string) => String(form.get(k) ?? "");
    startTransition(async () => {
      const res = await createTrip({
        name: get("name"),
        description: get("description"),
        startDate: get("startDate"),
        endDate: get("endDate"),
        currency: get("currency"),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success("Viaje creado");
      router.push(`/trips/${res.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nuevo viaje
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo viaje</DialogTitle>
          <DialogDescription>Después podrás invitar al grupo con un enlace.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Patagonia 2026" required aria-invalid={!!errors.name} />
            <FieldError errors={errors.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Desde</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">Hasta</Label>
              <Input id="endDate" name="endDate" type="date" aria-invalid={!!errors.endDate} />
            </div>
          </div>
          <FieldError errors={errors.endDate} />
          <div className="grid gap-2">
            <Label htmlFor="currency">Moneda</Label>
            <NativeSelect id="currency" name="currency" defaultValue="CLP">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear viaje"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
