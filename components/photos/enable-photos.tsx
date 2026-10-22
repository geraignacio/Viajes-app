"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { connectDrive, enablePhotos } from "@/server-actions/photos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EnablePhotos({ tripId, canEnable, activate }: { tripId: string; canEnable: boolean; activate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tried = useRef(false);

  // Al volver de Google con el permiso dado, crea la carpeta sola.
  useEffect(() => {
    if (!canEnable || !activate || tried.current) return;
    tried.current = true;
    startTransition(async () => {
      const res = await enablePhotos(tripId);
      router.replace(`/trips/${tripId}/photos`);
      if (!res.ok) toast.error(res.error);
      else if (res.data.needsDrive) toast.error("No se dio permiso para usar Google Drive");
      else toast.success("Fotos activadas. La carpeta ya está en tu Drive.");
    });
  }, [canEnable, activate, router, tripId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="text-primary size-5" /> Álbum compartido del viaje
        </CardTitle>
        <CardDescription>
          Todo el grupo puede tomar fotos y videos desde la app (o subirlos de la galería) y quedan guardados en
          calidad original en una carpeta de Google Drive compartida con los integrantes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEnable ? (
          <>
            <form action={connectDrive.bind(null, tripId)}>
              <Button type="submit" disabled={pending}>
                <HardDrive /> {pending ? "Creando carpeta…" : "Activar con Google Drive"}
              </Button>
            </form>
            <p className="text-muted-foreground text-xs">
              Se crea la carpeta en tu Drive y se usa tu espacio. La app solo puede ver los archivos que ella misma
              crea, nunca el resto de tu Drive.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">El organizador del viaje todavía no activa las fotos.</p>
        )}
      </CardContent>
    </Card>
  );
}
