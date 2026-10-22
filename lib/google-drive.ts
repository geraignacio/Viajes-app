import "server-only";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/action-result";

// Fotos del viaje en Google Drive.
//  * Scope drive.file: la app solo ve los archivos que ella misma creó (la
//    carpeta del viaje y lo que se sube desde aquí), nunca el resto del Drive.
//  * Una sola cuenta por viaje (Trip.driveOwnerId) es dueña de la carpeta y
//    todas las subidas usan su token: el resto del grupo no tiene que dar
//    permisos de Drive. A cada integrante con cuenta se le comparte la carpeta
//    como lector para que pueda verla y descargarla desde Drive.
//  * Los archivos van directo del celular a Google (subida reanudable): el
//    servidor solo abre la sesión, así no pasan por Vercel (límite de 4,5 MB).

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveAuthError extends ActionError {}

export function hasDriveScope(scope: string | null | undefined) {
  return !!scope?.split(" ").includes(DRIVE_SCOPE);
}

/** Token de acceso vigente de la cuenta de Google del usuario (lo renueva si venció). */
export async function getDriveToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({ where: { userId, provider: "google" } });
  if (!account || !hasDriveScope(account.scope) || !account.refresh_token) {
    throw new DriveAuthError("Hay que volver a conectar Google Drive");
  }
  const now = Math.floor(Date.now() / 1000);
  if (account.access_token && account.expires_at && account.expires_at > now + 60) return account.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    // invalid_grant: el permiso fue revocado o caducó.
    console.error("Drive token refresh failed", res.status, data.error);
    throw new DriveAuthError("Hay que volver a conectar Google Drive");
  }
  await prisma.account.update({
    where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
    data: {
      access_token: data.access_token,
      expires_at: now + (data.expires_in ?? 3600),
      refresh_token: data.refresh_token ?? undefined,
      scope: data.scope ?? undefined,
    },
  });
  return data.access_token;
}

/** Llamada a la API de Drive con mensajes de error aptos para mostrar. */
export async function driveFetch<T = unknown>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `${API}${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await driveError(res);
  return (await res.json()) as T;
}

async function driveError(res: Response) {
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; errors?: { reason?: string }[] };
  };
  const reason = body.error?.errors?.[0]?.reason ?? "";
  console.error("Drive API error", res.status, reason, body.error?.message);
  if (res.status === 401) return new DriveAuthError("Hay que volver a conectar Google Drive");
  if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED")
    return new ActionError("Falta activar la API de Google Drive en Google Cloud");
  if (reason === "storageQuotaExceeded") return new ActionError("El Drive del viaje está lleno");
  if (res.status === 404) return new ActionError("La carpeta o el archivo ya no existe en Drive");
  return new ActionError("Google Drive no respondió. Intenta de nuevo.");
}

export async function createTripFolder(token: string, tripName: string) {
  return driveFetch<{ id: string }>(token, "/files?fields=id", {
    method: "POST",
    body: JSON.stringify({ name: `Viajes – ${tripName}`, mimeType: FOLDER_MIME }),
  });
}

/** Comparte la carpeta (solo lectura) con un correo. Devuelve el id del permiso. */
export async function shareFolder(token: string, folderId: string, email: string) {
  const p = await driveFetch<{ id: string }>(
    token,
    `/files/${folderId}/permissions?sendNotificationEmail=false&fields=id`,
    { method: "POST", body: JSON.stringify({ type: "user", role: "reader", emailAddress: email }) },
  );
  return p.id;
}

export async function unshareFolder(token: string, folderId: string, permissionId: string) {
  await driveFetch(token, `/files/${folderId}/permissions/${permissionId}`, { method: "DELETE" }).catch((e) => {
    if (!(e instanceof ActionError) || !e.message.includes("ya no existe")) throw e;
  });
}

/**
 * Abre una subida reanudable dentro de la carpeta. Devuelve la URL de sesión,
 * a la que el navegador envía el archivo sin necesitar el token.
 */
export async function startResumableUpload(
  token: string,
  folderId: string,
  file: { name: string; mimeType: string; size: number },
  origin: string,
) {
  const res = await fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.mimeType,
      "X-Upload-Content-Length": String(file.size),
      // Google responde con CORS para este origen cuando el navegador sube.
      Origin: origin,
    },
    body: JSON.stringify({ name: file.name, parents: [folderId] }),
  });
  const location = res.headers.get("location");
  if (!res.ok || !location) throw await driveError(res);
  return location;
}

export async function getDriveFile(token: string, fileId: string) {
  return driveFetch<{ id: string; name: string; mimeType: string; parents?: string[]; trashed?: boolean }>(
    token,
    `/files/${fileId}?fields=id,name,mimeType,parents,trashed`,
  );
}

export async function trashDriveFile(token: string, fileId: string) {
  await driveFetch(token, `/files/${fileId}?fields=id`, { method: "PATCH", body: JSON.stringify({ trashed: true }) }).catch(
    (e) => {
      if (!(e instanceof ActionError) || !e.message.includes("ya no existe")) throw e;
    },
  );
}

export const folderUrl = (folderId: string) => `https://drive.google.com/drive/folders/${folderId}`;
export const fileUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/view`;

/**
 * Comparte la carpeta con los integrantes con cuenta que aún no la tienen.
 * Idempotente: se llama al activar las fotos, al unirse alguien y al abrir la galería.
 */
export async function syncFolderSharing(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      driveFolderId: true,
      driveOwnerId: true,
      members: {
        where: { leftAt: null, userId: { not: null }, drivePermissionId: null },
        select: { id: true, userId: true, user: { select: { email: true } } },
      },
    },
  });
  if (!trip?.driveFolderId || !trip.driveOwnerId) return;
  const pending = trip.members.filter((m) => m.userId !== trip.driveOwnerId && m.user?.email);
  if (pending.length === 0) return;
  const token = await getDriveToken(trip.driveOwnerId);
  for (const m of pending) {
    const permissionId = await shareFolder(token, trip.driveFolderId, m.user!.email);
    await prisma.tripMember.update({ where: { id: m.id }, data: { drivePermissionId: permissionId } });
  }
}

/** Quita el acceso a la carpeta de quien sale del viaje. */
export async function revokeFolderSharing(memberId: string) {
  const member = await prisma.tripMember.findUnique({
    where: { id: memberId },
    select: { drivePermissionId: true, trip: { select: { driveFolderId: true, driveOwnerId: true } } },
  });
  const { driveFolderId, driveOwnerId } = member?.trip ?? {};
  if (!member?.drivePermissionId || !driveFolderId || !driveOwnerId) return;
  const token = await getDriveToken(driveOwnerId);
  await unshareFolder(token, driveFolderId, member.drivePermissionId);
  await prisma.tripMember.update({ where: { id: memberId }, data: { drivePermissionId: null } });
}
