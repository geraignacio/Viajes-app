"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ExternalLink, FolderOpen, ImageUp, Loader2, Play, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { connectDrive, deletePhoto, finishPhotoUpload, startPhotoUpload } from "@/server-actions/photos";
import { guessMimeType, uploadToDrive } from "@/lib/drive-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export type GalleryPhoto = {
  id: string;
  name: string;
  isVideo: boolean;
  driveUrl: string;
  uploadedBy: string;
  canDelete: boolean;
};

type QueueItem = { key: string; name: string; progress: number; status: "waiting" | "uploading" | "error" };

export function PhotoGallery({
  tripId,
  folderUrl,
  ownerName,
  isDriveOwner,
  photos,
}: {
  tripId: string;
  folderUrl: string;
  ownerName: string | null;
  isDriveOwner: boolean;
  photos: GalleryPhoto[];
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [open, setOpen] = useState<GalleryPhoto | null>(null);
  const busy = useRef(false);
  const pendingFiles = useRef<{ key: string; file: File }[]>([]);
  const uploading = queue.some((q) => q.status !== "error");

  // Mientras sube: avisa antes de cerrar y evita que la pantalla se apague.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      window.removeEventListener("beforeunload", warn);
      lock?.release().catch(() => {});
    };
  }, [uploading]);

  const update = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function processQueue() {
    if (busy.current) return;
    busy.current = true;
    let uploaded = 0;
    // De a uno: en datos móviles subir varios a la vez solo los hace más lentos a todos.
    while (pendingFiles.current.length > 0) {
      const { key, file } = pendingFiles.current.shift()!;
      update(key, { status: "uploading" });
      try {
        const mimeType = guessMimeType(file);
        const start = await startPhotoUpload({ tripId, name: file.name || `archivo-${Date.now()}`, mimeType, size: file.size });
        if (!start.ok) throw new Error(start.error);
        const fileId = await uploadToDrive(start.data.uploadUrl, file, (p) => update(key, { progress: p }));
        const done = await finishPhotoUpload({ tripId, fileId });
        if (!done.ok) throw new Error(done.error);
        setQueue((q) => q.filter((item) => item.key !== key));
        uploaded++;
        router.refresh();
      } catch (e) {
        update(key, { status: "error" });
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "no se pudo subir"}`);
      }
    }
    busy.current = false;
    if (uploaded > 0) toast.success(uploaded === 1 ? "Archivo subido" : `${uploaded} archivos subidos`);
  }

  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.size > 0);
    if (files.length === 0) return;
    const items = files.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file }));
    pendingFiles.current.push(...items);
    setQueue((q) => [
      ...q.filter((item) => item.status !== "error"),
      ...items.map(({ key, file }) => ({ key, name: file.name, progress: 0, status: "waiting" as const })),
    ]);
    void processQueue();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
        <PickButton icon={<Camera />} label="Tomar foto" accept="image/*" capture onFiles={addFiles} />
        <PickButton icon={<Video />} label="Grabar video" accept="video/*" capture onFiles={addFiles} />
        <PickButton icon={<ImageUp />} label="Subir de la galería" accept="image/*,video/*" multiple onFiles={addFiles} />
      </div>

      {queue.length > 0 && (
        <Card className="gap-3 py-4">
          <CardContent className="space-y-3 px-4">
            <p className="text-muted-foreground text-xs">No cierres la app hasta que termine la subida.</p>
            {queue.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {item.status === "error"
                      ? "Error"
                      : item.status === "waiting"
                        ? "En espera"
                        : `${Math.round(item.progress * 100)}%`}
                  </span>
                </div>
                <Progress
                  value={item.progress}
                  indicatorClassName={item.status === "error" ? "bg-destructive" : undefined}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {photos.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          Aún no hay fotos. Toma la primera o súbelas desde tu galería.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(p)}
              className="bg-muted relative aspect-square overflow-hidden rounded-md"
              aria-label={`Ver ${p.name}`}
            >
              <Thumb tripId={tripId} photo={p} size={400} className="size-full object-cover" />
              {p.isVideo && (
                <span className="absolute right-1 bottom-1 rounded-full bg-black/60 p-1 text-white">
                  <Play className="size-3 fill-current" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href={folderUrl} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-1">
          <FolderOpen className="size-4" /> Abrir carpeta en Google Drive
        </a>
        <span className="text-xs">
          {isDriveOwner ? "Se guardan en tu Drive" : `Se guardan en el Drive de ${ownerName ?? "el organizador"}`}, en
          calidad original.
        </span>
        {isDriveOwner && (
          <form action={connectDrive.bind(null, tripId)}>
            <button type="submit" className="hover:text-foreground text-xs underline underline-offset-2">
              Reconectar Drive
            </button>
          </form>
        )}
      </div>

      <PhotoDialog tripId={tripId} photo={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function PickButton({
  icon,
  label,
  accept,
  capture,
  multiple,
  onFiles,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  capture?: boolean;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <label className="border-input bg-background hover:bg-accent focus-within:ring-ring/50 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium shadow-xs transition-colors focus-within:ring-[3px] sm:text-sm [&_svg]:size-6 [&_svg]:text-primary">
      {icon}
      {label}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        // capture abre la cámara directo; el archivo llega tal cual lo guarda el celular.
        capture={capture ? "environment" : undefined}
        multiple={multiple}
        onChange={(e) => {
          onFiles(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function Thumb({
  tripId,
  photo,
  size,
  className,
}: {
  tripId: string;
  photo: GalleryPhoto;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Si la imagen falló antes de que React tomara el control, onError no se dispara.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <span className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-2 text-xs">
        {photo.isVideo ? <Video className="size-6" /> : <Camera className="size-6" />}
        {photo.isVideo ? "Procesando video…" : "Sin vista previa"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura privada servida por nuestra API
    <img
      ref={img}
      src={`/api/trips/${tripId}/photos/${photo.id}/thumb?size=${size}`}
      alt={photo.name}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function PhotoDialog({ tripId, photo, onClose }: { tripId: string; photo: GalleryPhoto | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={!!photo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        {photo && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{photo.name}</DialogTitle>
              <DialogDescription>Subido por {photo.uploadedBy}</DialogDescription>
            </DialogHeader>
            <div className="bg-muted flex min-h-48 items-center justify-center overflow-hidden rounded-md">
              <Thumb key={photo.id} tripId={tripId} photo={photo} size={1600} className="max-h-[65dvh] w-auto object-contain" />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button asChild variant="secondary" size="sm">
                <a href={photo.driveUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> {photo.isVideo ? "Ver video en Drive" : "Abrir original en Drive"}
                </a>
              </Button>
              {photo.canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("¿Borrar este archivo? Queda en la papelera de Drive por 30 días.")) return;
                    startTransition(async () => {
                      const res = await deletePhoto({ tripId, photoId: photo.id });
                      if (res.ok) {
                        toast.success("Borrado");
                        onClose();
                      } else toast.error(res.error);
                    });
                  }}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Borrar
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
