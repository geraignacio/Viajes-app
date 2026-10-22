import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/access";
import { fileUrl, folderUrl, syncFolderSharing } from "@/lib/google-drive";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { EnablePhotos } from "@/components/photos/enable-photos";

export const metadata = { title: "Fotos del viaje" };

export default async function TripPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ activar?: string }>;
}) {
  const [{ tripId }, { activar }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/trips/${tripId}/photos`);

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      driveOwner: { select: { name: true } },
      members: { select: { id: true, userId: true, role: true, leftAt: true, displayName: true } },
      photos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!trip) notFound();
  const me = trip.members.find((m) => m.userId === user.id);
  if (!me || me.leftAt) notFound();
  const canModerate = me.role !== "MEMBER";
  const nameOf = new Map(trip.members.map((m) => [m.id, m.displayName]));

  // Por si alguien se unió y no se alcanzó a compartir la carpeta con él.
  if (trip.driveFolderId) after(() => syncFolderSharing(trip.id).catch((e) => console.error(e)));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/trips/${trip.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {trip.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Fotos y videos</h1>
      </div>

      {trip.driveFolderId ? (
        <PhotoGallery
          tripId={trip.id}
          folderUrl={folderUrl(trip.driveFolderId)}
          ownerName={trip.driveOwner?.name ?? null}
          isDriveOwner={trip.driveOwnerId === user.id}
          photos={trip.photos.map((p) => ({
            id: p.id,
            name: p.name,
            isVideo: p.mimeType.startsWith("video/"),
            driveUrl: fileUrl(p.driveFileId),
            uploadedBy: nameOf.get(p.uploadedById) ?? "",
            canDelete: canModerate || p.uploadedById === me.id,
          }))}
        />
      ) : (
        <EnablePhotos tripId={trip.id} canEnable={canModerate} activate={activar === "1"} />
      )}
    </div>
  );
}
