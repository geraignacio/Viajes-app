import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/action-result";

/** Una sola lectura de sesión por request, aunque la pidan layout y página. */
export const getSessionUser = cache(async () => {
  const session = await auth();
  return session?.user?.id ? { ...session.user, id: session.user.id } : null;
});

/** Para páginas: redirige al login si no hay sesión. */
export async function requireUser(callbackUrl?: string) {
  const user = await getSessionUser();
  if (!user) redirect(callbackUrl ? `/?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/");
  return user;
}

/**
 * Para Server Actions y rutas: verifica que el usuario autenticado sea
 * integrante activo del viaje. Lanza ActionError (nunca filtra si el viaje
 * existe o no a quien no es miembro).
 */
export async function requireMember(tripId: string) {
  const user = await getSessionUser();
  if (!user) throw new ActionError("Debes iniciar sesión");
  const member = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId: user.id } },
    include: { trip: true },
  });
  if (!member || member.leftAt) throw new ActionError("No tienes acceso a este viaje");
  return { user, member, trip: member.trip };
}
