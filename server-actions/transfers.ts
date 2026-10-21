"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { toMinor } from "@/lib/money";
import { canActFor } from "@/lib/permissions";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { deleteByIdSchema } from "@/lib/validation/expense";
import { transferInputSchema } from "@/lib/validation/transfer";

/** "Pagué $X a [integrante]". */
export async function createTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = transferInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const { member: me, trip } = await requireMember(input.tripId);
    if (trip.archivedAt) throw new ActionError("El viaje está cerrado");

    const both = await prisma.tripMember.findMany({
      where: { tripId: trip.id, id: { in: [input.fromMemberId, input.toMemberId] } },
      select: { id: true, userId: true, parentMemberId: true },
    });
    const from = both.find((m) => m.id === input.fromMemberId);
    if (both.length !== 2 || !from) throw new ActionError("Integrante inválido");
    // Registras tus propios abonos; también puedes confirmar uno que te hicieron a ti.
    if (!canActFor(me, from) && input.toMemberId !== me.id) {
      throw new ActionError("Solo puedes registrar abonos que hiciste tú o que te hicieron a ti", {
        fromMemberId: ["Cada persona con cuenta registra sus propios abonos"],
      });
    }

    const transfer = await prisma.transfer.create({
      data: {
        tripId: trip.id,
        fromMemberId: input.fromMemberId,
        toMemberId: input.toMemberId,
        amount: toMinor(input.amount, trip.currency),
        date: new Date(input.date),
        note: input.note,
        createdById: me.id,
      },
      select: { id: true },
    });
    revalidatePath(`/trips/${trip.id}`);
    return ok(transfer);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTransfer(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deleteByIdSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: parsed.data.id },
      select: { tripId: true, createdById: true, fromMemberId: true, deletedAt: true },
    });
    if (!transfer || transfer.deletedAt) throw new ActionError("El abono no existe");
    const { member } = await requireMember(transfer.tripId);
    const canDelete =
      member.role !== "MEMBER" ||
      member.id === transfer.createdById ||
      member.id === transfer.fromMemberId;
    if (!canDelete) throw new ActionError("No puedes borrar este abono");
    await prisma.transfer.update({
      where: { id: parsed.data.id },
      data: { deletedAt: new Date() },
    });
    revalidatePath(`/trips/${transfer.tripId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
