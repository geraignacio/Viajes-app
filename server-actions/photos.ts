"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import {
  DRIVE_SCOPE,
  DriveAuthError,
  createTripFolder,
  getDriveFile,
  getDriveToken,
  hasDriveScope,
  startResumableUpload,
  syncFolderSharing,
  trashDriveFile,
} from "@/lib/google-drive";
import { deletePhotoSchema, finishUploadSchema, startUploadSchema } from "@/lib/validation/photo";

const photosPath = (tripId: string) => `/trips/${tripId}/photos`;

/**
 * Lleva a Google a pedir permiso de Drive (solo archivos creados por la app).
 * Al volver, la página llama a enablePhotos para crear la carpeta.
 */
export async function connectDrive(tripId: string) {
  await requireMember(tripId);
  await signIn(
    "google",
    { redirectTo: `${photosPath(tripId)}?activar=1` },
    {
      scope: `openid email profile ${DRIVE_SCOPE}`,
      access_type: "offline", // refresh token para subir aunque no esté conectado
      prompt: "consent",
      include_granted_scopes: "true",
    },
  );
}

/** Crea la carpeta del viaje en el Drive del organizador y la comparte con el grupo. */
export async function enablePhotos(tripId: string): Promise<ActionResult<{ needsDrive: boolean }>> {
  try {
    const { user, member, trip } = await requireMember(tripId);
    if (trip.driveFolderId) return ok({ needsDrive: false });
    if (member.role === "MEMBER") throw new ActionError("Solo el organizador puede activar las fotos");

    const account = await prisma.account.findFirst({ where: { userId: user.id, provider: "google" } });
    if (!account?.refresh_token || !hasDriveScope(account.scope)) return ok({ needsDrive: true });

    const token = await getDriveToken(user.id);
    const folder = await createTripFolder(token, trip.name);
    // Condicional: si dos personas activan a la vez, gana la primera.
    const set = await prisma.trip.updateMany({
      where: { id: tripId, driveFolderId: null },
      data: { driveFolderId: folder.id, driveOwnerId: user.id },
    });
    if (set.count === 0) await trashDriveFile(token, folder.id);
    else await syncFolderSharing(tripId);

    revalidatePath(photosPath(tripId));
    return ok({ needsDrive: false });
  } catch (e) {
    if (e instanceof DriveAuthError) return ok({ needsDrive: true });
    return fail(e);
  }
}

async function requirePhotos(tripId: string) {
  const ctx = await requireMember(tripId);
  const { driveFolderId, driveOwnerId } = ctx.trip;
  if (!driveFolderId || !driveOwnerId) throw new ActionError("Las fotos no están activadas en este viaje");
  try {
    return { ...ctx, folderId: driveFolderId, token: await getDriveToken(driveOwnerId) };
  } catch (e) {
    if (e instanceof DriveAuthError && driveOwnerId !== ctx.user.id) {
      const owner = await prisma.user.findUnique({ where: { id: driveOwnerId }, select: { name: true } });
      throw new ActionError(`${owner?.name ?? "Quien activó las fotos"} tiene que volver a conectar Google Drive`);
    }
    throw e;
  }
}

/** Abre una subida directa a Drive; el navegador envía el archivo a la URL devuelta. */
export async function startPhotoUpload(raw: unknown): Promise<ActionResult<{ uploadUrl: string }>> {
  const parsed = startUploadSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { tripId, ...file } = parsed.data;
  try {
    const { token, folderId } = await requirePhotos(tripId);
    const h = await headers();
    const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    return ok({ uploadUrl: await startResumableUpload(token, folderId, file, origin) });
  } catch (e) {
    return fail(e);
  }
}

/** Registra en la galería un archivo ya subido (verificando que esté en la carpeta del viaje). */
export async function finishPhotoUpload(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = finishUploadSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { tripId, fileId } = parsed.data;
  try {
    const { token, folderId, member } = await requirePhotos(tripId);
    const file = await getDriveFile(token, fileId);
    if (file.trashed || !file.parents?.includes(folderId)) throw new ActionError("Archivo inválido");
    await prisma.tripPhoto.upsert({
      where: { driveFileId: file.id },
      create: {
        tripId,
        driveFileId: file.id,
        name: file.name.slice(0, 255),
        mimeType: file.mimeType.slice(0, 100),
        uploadedById: member.id,
      },
      update: {},
    });
    revalidatePath(photosPath(tripId));
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

/** Borra una foto (la manda a la papelera de Drive). Puede hacerlo quien la subió o el organizador. */
export async function deletePhoto(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deletePhotoSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { tripId, photoId } = parsed.data;
  try {
    const { token, member } = await requirePhotos(tripId);
    const photo = await prisma.tripPhoto.findFirst({ where: { id: photoId, tripId } });
    if (!photo) throw new ActionError("La foto ya no existe");
    if (photo.uploadedById !== member.id && member.role === "MEMBER")
      throw new ActionError("Solo quien la subió o el organizador pueden borrarla");
    await trashDriveFile(token, photo.driveFileId);
    await prisma.tripPhoto.delete({ where: { id: photo.id } });
    revalidatePath(photosPath(tripId));
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
