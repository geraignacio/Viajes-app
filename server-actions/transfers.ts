"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { toMinor } from "@/lib/money";
import { canActFor } from "@/lib/permissions";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { deleteByIdSchema } from "@/lib/validation/expense";
import { settleExpenseSchema, transferInputSchema } from "@/lib/validation/transfer";
import { expenseDebts } from "@/lib/finance/expense-debts";
import { familyHeads } from "@/lib/finance/families";

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

/**
 * "Saldar" la deuda de un gasto: registra un abono de `from` a `to` por lo que
 * falta de ESE gasto, ligado al gasto. Para los saldos es un abono normal.
 */
export async function settleExpenseDebt(raw: unknown): Promise<ActionResult<{ id: string; amount: number }>> {
  const parsed = settleExpenseSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const expense = await prisma.expense.findUnique({
      where: { id: input.expenseId },
      select: {
        tripId: true,
        title: true,
        deletedAt: true,
        payers: { select: { memberId: true, amount: true } },
        splits: { select: { memberId: true, amount: true } },
        transfers: {
          where: { deletedAt: null },
          select: { fromMemberId: true, toMemberId: true, amount: true },
        },
      },
    });
    if (!expense || expense.deletedAt) throw new ActionError("El gasto no existe");
    const { member: me, trip } = await requireMember(expense.tripId);
    if (trip.archivedAt) throw new ActionError("El viaje está cerrado");

    const members = await prisma.tripMember.findMany({
      where: { tripId: trip.id },
      select: { id: true, userId: true, parentMemberId: true },
    });
    const from = members.find((m) => m.id === input.fromMemberId);
    if (!from) throw new ActionError("Integrante inválido");
    if (!canActFor(me, from) && input.toMemberId !== me.id) {
      throw new ActionError("Solo puedes saldar deudas tuyas o que te deben a ti");
    }

    const debt = expenseDebts(expense.payers, expense.splits, expense.transfers, familyHeads(members)).find(
      (d) => d.from === input.fromMemberId && d.to === input.toMemberId,
    );
    if (!debt) throw new ActionError("No hay deuda entre estas personas en este gasto");
    if (debt.remaining <= 0) throw new ActionError("Esta deuda ya está saldada");

    const transfer = await prisma.transfer.create({
      data: {
        tripId: trip.id,
        fromMemberId: debt.from,
        toMemberId: debt.to,
        amount: debt.remaining,
        date: new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" })),
        note: `Saldo de ${expense.title}`.slice(0, 500),
        expenseId: input.expenseId,
        createdById: me.id,
      },
      select: { id: true, amount: true },
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

/** Deshacer un borrado reciente (mismos permisos que para borrar). */
export async function restoreTransfer(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deleteByIdSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: parsed.data.id },
      select: { tripId: true, createdById: true, fromMemberId: true, deletedAt: true },
    });
    if (!transfer) throw new ActionError("El abono no existe");
    if (!transfer.deletedAt) return ok(undefined);
    const { member, trip } = await requireMember(transfer.tripId);
    if (trip.archivedAt) throw new ActionError("El viaje está cerrado");
    const canRestore =
      member.role !== "MEMBER" ||
      member.id === transfer.createdById ||
      member.id === transfer.fromMemberId;
    if (!canRestore) throw new ActionError("No puedes recuperar este abono");
    await prisma.transfer.update({ where: { id: parsed.data.id }, data: { deletedAt: null } });
    revalidatePath(`/trips/${transfer.tripId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
