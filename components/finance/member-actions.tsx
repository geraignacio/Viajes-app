"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { removeMember, setMemberParent } from "@/server-actions/members";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Option = { id: string; name: string };

/** Editar a un integrante: dejarlo a cargo de un padre/madre o quitarlo del viaje. */
export function MemberActions({
  tripId,
  member,
  isMe,
  canRemove,
  hasChildren,
  parentOptions,
}: {
  tripId: string;
  member: { id: string; name: string; parentId: string | null };
  isMe: boolean;
  canRemove: boolean;
  hasChildren: boolean;
  /** Integrantes activos que pueden tener hijos/as a cargo (no son hijos/as). */
  parentOptions: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState(member.parentId ?? "");
  const [pending, startTransition] = useTransition();
  const options = parentOptions.filter((o) => o.id !== member.id);

  function saveParent() {
    startTransition(async () => {
      const res = await setMemberParent({ tripId, memberId: member.id, parentMemberId: parentId || null });
      if (!res.ok) return void toast.error(res.error);
      const parent = options.find((o) => o.id === parentId);
      toast.success(parent ? `${member.name} queda a cargo de ${parent.name}` : `${member.name} paga lo suyo`, {
        description: res.data.resetPlans ? "Los planes de cuotas involucrados se reiniciaron." : undefined,
      });
      setOpen(false);
    });
  }

  function remove() {
    const msg = isMe ? "¿Salir de este viaje?" : `¿Quitar a ${member.name} del viaje?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await removeMember({ tripId, memberId: member.id });
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      if (res.data.left) {
        toast.success("Saliste del viaje");
        router.push("/trips");
      } else toast.success(`${member.name} ya no está en el viaje`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setParentId(member.parentId ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground size-8" aria-label={`Editar a ${member.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>
            Si es hijo/a de alguien del viaje, su deuda se suma a la de su padre o madre en el cierre de cuentas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`parent-${member.id}`}>Hijo/a a cargo de</Label>
          {hasChildren ? (
            <p className="text-muted-foreground text-sm">Tiene hijos/as a su cargo, así que paga por su cuenta.</p>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <NativeSelect id={`parent-${member.id}`} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Nadie (paga lo suyo)</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button onClick={saveParent} disabled={pending || parentId === (member.parentId ?? "")}>
                Guardar
              </Button>
            </div>
          )}
        </div>

        {canRemove && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              Solo se puede quitar a alguien con su saldo en cero. Si no tiene gastos registrados se borra del todo.
            </p>
            <Button variant="outline" className="text-destructive w-full" onClick={remove} disabled={pending}>
              <UserMinus /> {isMe ? "Salir del viaje" : "Quitar del viaje"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
