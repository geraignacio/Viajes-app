"use server";

import { revalidatePath } from "next/cache";
import type { TripMember } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { getTripBalances } from "@/lib/finance/balances";
import { revokeFolderSharing } from "@/lib/google-drive";
import { formatMoney } from "@/lib/money";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { removeMemberSchema, setParentSchema } from "@/lib/validation/trip";

/**
 * Quién puede editar a un integrante: el organizador (OWNER/ADMIN), la propia
 * persona, cualquiera si es alguien sin cuenta, y el padre/madre de su hijo/a.
 */
function canManage(me: TripMember, target: TripMember) {
  return me.role !== "MEMBER" || me.id === target.id || !target.userId || target.parentMemberId === me.id;
}

async function loadTarget(tripId: string, memberId: string) {
  const { member: me, trip } = await requireMember(tripId);
  if (trip.archivedAt) throw new ActionError("El viaje está cerrado");
  const target = await prisma.tripMember.findFirst({ where: { id: memberId, tripId, leftAt: null } });
  if (!target) throw new ActionError("Integrante inválido");
  if (!canManage(me, target)) throw new ActionError("Solo el organizador puede editar a otras personas");
  return { me, target };
}

/**
 * Quita a alguien del viaje.
 *  - Sin movimientos (gastos, divisiones, abonos): se borra del todo.
 *  - Con movimientos y saldo en cero: queda en el historial pero sale del viaje.
 *  - Con saldo pendiente: no se puede (los saldos dejarían de cuadrar).
 * Sus hijos/as a cargo pasan a responder por sí mismos.
 */
export async function removeMember(raw: unknown): Promise<ActionResult<{ left: boolean }>> {
  const parsed = removeMemberSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { tripId, memberId } = parsed.data;

  try {
    const { me, target } = await loadTarget(tripId, memberId);
    if (target.role === "OWNER") throw new ActionError("No se puede quitar a quien creó el viaje");

    const [counts, balances] = await Promise.all([
      prisma.tripMember.findUniqueOrThrow({
        where: { id: memberId },
        select: {
          _count: {
            select: {
              payments: true,
              splits: true,
              transfersSent: true,
              transfersReceived: true,
              transfersCreated: true,
              expensesCreated: true,
              photos: true,
            },
          },
        },
      }),
      getTripBalances(prisma, tripId),
    ]);
    const hasHistory = Object.values(counts._count).some((n) => n > 0);
    const balance = balances.find((b) => b.memberId === memberId)?.balance ?? 0;

    if (hasHistory && balance !== 0) {
      const amount = formatMoney(Math.abs(balance), (await prisma.trip.findUniqueOrThrow({ where: { id: tripId } })).currency);
      throw new ActionError(
        balance < 0
          ? `${target.displayName} aún debe ${amount}. Registra su pago o borra sus gastos antes de quitarlo.`
          : `A ${target.displayName} aún le deben ${amount}. Salden esa deuda antes de quitarlo.`,
      );
    }

    // Deja de ver la carpeta de fotos en Drive (si falla, igual sale del viaje).
    await revokeFolderSharing(memberId).catch((e) => console.error(e));

    await prisma.$transaction(async (tx) => {
      await tx.tripMember.updateMany({ where: { parentMemberId: memberId }, data: { parentMemberId: null } });
      if (hasHistory) {
        await tx.installmentPlan.deleteMany({ where: { memberId } });
        await tx.tripMember.update({ where: { id: memberId }, data: { leftAt: new Date(), parentMemberId: null } });
      } else {
        await tx.tripMember.delete({ where: { id: memberId } });
      }
    });

    revalidatePath("/trips");
    revalidatePath(`/trips/${tripId}`);
    return ok({ left: me.id === memberId });
  } catch (e) {
    return fail(e);
  }
}

/** Marca a alguien como hijo/a a cargo de otro integrante (o lo desvincula). */
export async function setMemberParent(raw: unknown): Promise<ActionResult<{ resetPlans: boolean }>> {
  const parsed = setParentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { tripId, memberId, parentMemberId } = parsed.data;

  try {
    const { target } = await loadTarget(tripId, memberId);
    if (target.parentMemberId === parentMemberId) return ok({ resetPlans: false });

    if (parentMemberId) {
      if (parentMemberId === memberId) throw new ActionError("Una persona no puede estar a su propio cargo");
      const parent = await prisma.tripMember.findFirst({ where: { id: parentMemberId, tripId, leftAt: null } });
      if (!parent) throw new ActionError("Elige a un integrante del viaje");
      if (parent.parentMemberId) throw new ActionError(`${parent.displayName} ya está a cargo de otra persona`);
      const ownChildren = await prisma.tripMember.count({ where: { parentMemberId: memberId } });
      if (ownChildren > 0) throw new ActionError(`${target.displayName} tiene hijos/as a su cargo`);
    }

    // Los planes de cuotas se arman sobre la deuda familiar: al cambiar la
    // familia dejan de cuadrar, así que se reinician los involucrados.
    const affected = [memberId, target.parentMemberId, parentMemberId].filter((x): x is string => !!x);
    const [, plans] = await prisma.$transaction([
      prisma.tripMember.update({ where: { id: memberId }, data: { parentMemberId } }),
      prisma.installmentPlan.deleteMany({ where: { memberId: { in: affected } } }),
    ]);

    revalidatePath(`/trips/${tripId}`);
    return ok({ resetPlans: plans.count > 0 });
  } catch (e) {
    return fail(e);
  }
}
