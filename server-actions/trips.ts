"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMember, getSessionUser } from "@/lib/access";
import { generateInviteCode } from "@/lib/invite";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { addGuestSchema, createTripSchema, joinTripSchema } from "@/lib/validation/trip";

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function createTrip(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createTripSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Debes iniciar sesión");

    // Reintenta ante la (improbable) colisión del código de invitación.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const trip = await prisma.trip.create({
          data: {
            name: input.name,
            description: input.description,
            startDate: input.startDate ? new Date(input.startDate) : null,
            endDate: input.endDate ? new Date(input.endDate) : null,
            currency: input.currency,
            inviteCode: generateInviteCode(),
            createdById: user.id,
            members: {
              create: {
                userId: user.id,
                displayName: user.name ?? user.email ?? "Yo",
                role: "OWNER",
              },
            },
          },
          select: { id: true },
        });
        revalidatePath("/trips");
        return ok(trip);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    throw new ActionError("No se pudo generar el código de invitación");
  } catch (e) {
    return fail(e);
  }
}

/**
 * Unirse con código. Si el viaje tiene acompañantes sin cuenta, la persona
 * puede "reclamar" uno: se le asigna ese TripMember y hereda sus gastos.
 */
export async function joinTrip(raw: unknown): Promise<ActionResult<{ tripId: string }>> {
  const parsed = joinTripSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { code, claimMemberId } = parsed.data;

  try {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Debes iniciar sesión");

    const trip = await prisma.trip.findUnique({ where: { inviteCode: code } });
    if (!trip) throw new ActionError("El código no existe o fue regenerado");
    if (trip.archivedAt) throw new ActionError("Este viaje está cerrado");

    const existing = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: user.id } },
    });
    if (existing && !existing.leftAt) return ok({ tripId: trip.id });

    if (existing) {
      await prisma.tripMember.update({ where: { id: existing.id }, data: { leftAt: null } });
    } else if (claimMemberId) {
      // updateMany con condición = reclamo atómico (nadie más lo tomó antes).
      const claimed = await prisma.tripMember.updateMany({
        where: { id: claimMemberId, tripId: trip.id, userId: null },
        data: { userId: user.id, displayName: user.name ?? undefined },
      });
      if (claimed.count === 0) throw new ActionError("Ese integrante ya fue reclamado");
    } else {
      await prisma.tripMember.create({
        data: {
          tripId: trip.id,
          userId: user.id,
          displayName: user.name ?? user.email ?? "Integrante",
        },
      });
    }

    revalidatePath("/trips");
    revalidatePath(`/trips/${trip.id}`);
    return ok({ tripId: trip.id });
  } catch (e) {
    return fail(e);
  }
}

export async function addGuestMember(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = addGuestSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireMember(parsed.data.tripId);
    const member = await prisma.tripMember.create({
      data: { tripId: parsed.data.tripId, displayName: parsed.data.displayName },
      select: { id: true },
    });
    revalidatePath(`/trips/${parsed.data.tripId}`);
    return ok(member);
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateInviteCode(tripId: string): Promise<ActionResult<{ code: string }>> {
  try {
    const { member } = await requireMember(tripId);
    if (member.role === "MEMBER") throw new ActionError("Solo el organizador puede hacerlo");
    const code = generateInviteCode();
    await prisma.trip.update({ where: { id: tripId }, data: { inviteCode: code } });
    revalidatePath(`/trips/${tripId}`);
    return ok({ code });
  } catch (e) {
    return fail(e);
  }
}

export async function setTripArchived(
  tripId: string,
  archived: boolean,
): Promise<ActionResult<undefined>> {
  try {
    const { member } = await requireMember(tripId);
    if (member.role === "MEMBER") throw new ActionError("Solo el organizador puede hacerlo");
    await prisma.trip.update({
      where: { id: tripId },
      data: { archivedAt: archived ? new Date() : null },
    });
    revalidatePath("/trips");
    revalidatePath(`/trips/${tripId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
