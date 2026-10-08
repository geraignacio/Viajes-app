"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { joinTrip } from "@/server-actions/trips";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function JoinForm({ code, guests }: { code: string; guests: { id: string; name: string }[] }) {
  const router = useRouter();
  const [claim, setClaim] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      {guests.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="claim">¿Ya te agregaron con otro nombre?</Label>
          <NativeSelect id="claim" value={claim} onChange={(e) => setClaim(e.target.value)}>
            <option value="">No, soy nuevo en el grupo</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                Soy {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await joinTrip({ code, claimMemberId: claim || undefined });
            if (!res.ok) return void toast.error(res.error);
            router.push(`/trips/${res.data.tripId}`);
          })
        }
      >
        {pending ? "Uniéndote…" : "Unirme al viaje"}
      </Button>
    </div>
  );
}
