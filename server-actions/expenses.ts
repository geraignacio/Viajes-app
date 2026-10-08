"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { toMinor } from "@/lib/money";
import { computeSplits, type SplitInput } from "@/lib/finance/split";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { deleteByIdSchema, expenseInputSchema } from "@/lib/validation/expense";

export async function createExpense(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const { member: me, trip } = await requireMember(input.tripId);
    if (trip.archivedAt) throw new ActionError("El viaje está cerrado");
    const currency = trip.currency;

    const activeIds = (
      await prisma.tripMember.findMany({
        where: { tripId: trip.id, leftAt: null },
        select: { id: true },
      })
    ).map((m) => m.id);
    const active = new Set(activeIds);
    const assertMembers = (ids: string[], field: string) => {
      if (ids.some((id) => !active.has(id))) {
        throw new ActionError("Hay integrantes que no pertenecen al viaje", {
          [field]: ["Integrante inválido"],
        });
      }
    };

    const total = toMinor(input.amount, currency);

    // 1) Quién pagó → ExpensePayer[] (suma exacta = total).
    const payers =
      input.paidBy.mode === "single"
        ? [{ memberId: input.paidBy.memberId, amount: total }]
        : input.paidBy.payers
            .map((p) => ({ memberId: p.memberId, amount: toMinor(p.amount, currency) }))
            .filter((p) => p.amount > 0);
    assertMembers(payers.map((p) => p.memberId), "paidBy");
    const paidSum = payers.reduce((a, p) => a + p.amount, 0);
    if (payers.length === 0 || paidSum !== total) {
      throw new ActionError("Lo pagado no coincide con el total del gasto", {
        paidBy: ["La suma de los pagos debe ser igual al total"],
      });
    }

    // 2) Cómo se divide → ExpenseSplit[] (suma exacta = total).
    let splitInput: SplitInput;
    switch (input.split.type) {
      case "EQUAL_ALL":
        splitInput = { type: "EQUAL_ALL", memberIds: activeIds };
        break;
      case "EQUAL_SELECTED":
        splitInput = { type: "EQUAL_SELECTED", memberIds: input.split.memberIds };
        break;
      case "EXACT":
        splitInput = {
          type: "EXACT",
          shares: input.split.shares.map((s) => ({
            memberId: s.memberId,
            amount: toMinor(s.amount, currency),
          })),
        };
        break;
    }
    assertMembers(
      splitInput.type === "EXACT"
        ? splitInput.shares.map((s) => s.memberId)
        : splitInput.memberIds,
      "split",
    );
    let splits;
    try {
      splits = computeSplits(total, splitInput);
    } catch {
      throw new ActionError("Los montos por persona deben sumar el total", {
        split: ["La suma de los montos exactos debe ser igual al total"],
      });
    }

    // 3) Escritura atómica: gasto + pagadores + divisiones.
    const expense = await prisma.expense.create({
      data: {
        tripId: trip.id,
        title: input.title,
        notes: input.notes,
        amount: total,
        category: input.category,
        splitType: input.split.type,
        date: new Date(input.date),
        receiptUrl: input.receiptUrl,
        receiptNote: input.receiptNote,
        createdById: me.id,
        payers: { create: payers },
        splits: { create: splits },
      },
      select: { id: true },
    });

    revalidatePath(`/trips/${trip.id}`);
    return ok(expense);
  } catch (e) {
    return fail(e);
  }
}

/** Borrado lógico: el gasto deja de contar en saldos pero queda auditado. */
export async function deleteExpense(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deleteByIdSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: parsed.data.id },
      select: { tripId: true, createdById: true, deletedAt: true },
    });
    if (!expense || expense.deletedAt) throw new ActionError("El gasto no existe");
    const { member } = await requireMember(expense.tripId);
    if (member.role === "MEMBER" && member.id !== expense.createdById) {
      throw new ActionError("Solo quien registró el gasto o el organizador pueden borrarlo");
    }
    await prisma.expense.update({
      where: { id: parsed.data.id },
      data: { deletedAt: new Date() },
    });
    revalidatePath(`/trips/${expense.tripId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
