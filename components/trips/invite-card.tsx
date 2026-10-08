"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { regenerateInviteCode } from "@/server-actions/trips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InviteCard({ tripId, code, canRegenerate }: { tripId: string; code: string; canRegenerate: boolean }) {
  const [origin, setOrigin] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/join/${code}`;

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Únete al viaje", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    }
  }

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Invitar al grupo</CardTitle>
        <CardDescription>Comparte el enlace o el código.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2">
          <code className="text-lg font-semibold tracking-[0.2em]">{code}</code>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copiar código"
            onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("Código copiado"))}
          >
            <Copy />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={share}>
            <Share2 /> Compartir enlace
          </Button>
          {canRegenerate && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Generar código nuevo"
              title="Generar código nuevo (invalida el anterior)"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!confirm("El código y enlace actuales dejarán de funcionar. ¿Continuar?")) return;
                  const res = await regenerateInviteCode(tripId);
                  if (res.ok) toast.success("Código nuevo generado");
                  else toast.error(res.error);
                })
              }
            >
              <RefreshCw />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
