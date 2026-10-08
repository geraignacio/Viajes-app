"use client";

import { useRef, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addGuestMember } from "@/server-actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Agrega un acompañante sin cuenta; podrá reclamar su lugar al unirse. */
export function AddGuestForm({ tripId }: { tripId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      ref={ref}
      className="flex gap-2 border-t pt-4"
      action={(fd) =>
        startTransition(async () => {
          const res = await addGuestMember({ tripId, displayName: String(fd.get("displayName") ?? "") });
          if (res.ok) {
            ref.current?.reset();
            toast.success("Integrante agregado");
          } else toast.error(res.error);
        })
      }
    >
      <Input name="displayName" placeholder="Agregar persona sin cuenta" aria-label="Nombre" required />
      <Button type="submit" variant="outline" size="icon" disabled={pending} aria-label="Agregar">
        <UserPlus />
      </Button>
    </form>
  );
}
