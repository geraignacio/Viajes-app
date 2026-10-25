"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { convertAmount, toMinor } from "@/lib/money";
import { allocateProportional } from "@/lib/finance/fx";
import { computeSplits, type SplitInput } from "@/lib/finance/split";
import { canActFor } from "@/lib/permissions";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { deleteByIdSchema, expenseInputSchema } from "@/lib/validation/expense";

export async function createExpense(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const { member: me, trip } = await requireMember(input.tripId);
    if (trip.archivedAt) throw new ActionError("El viaje está cerrado");
    // Los montos llegan en `currency` (la del viaje u otra); se validan ahí y
    // después se convierten a la moneda del viaje, que es la de los saldos.
    const currency = input.currency ?? trip.currency;
    const foreign = currency !== trip.currency;
    if (foreign && !input.fxRate) {
      throw new ActionError("Falta el tipo de cambio", { fxRate: ["Indica el tipo de cambio"] });
    }
    const rate = foreign ? input.fxRate! : 1;

    const activeMembers = await prisma.tripMember.findMany({
      where: { tripId: trip.id, leftAt: null },
      select: { id: true, userId: true, parentMemberId: true },
    });
    const activeIds = activeMembers.map((m) => m.id);
    const active = new Set(activeIds);
    const assertMembers = (ids: string[], field: string) => {
      if (ids.some((id) => !active.has(id))) {
        throw new ActionError("Hay integrantes que no pertenecen al viaje", {
          [field]: ["Integrante inválido"],
        });
      }
    };

    const originalTotal = toMinor(input.amount, currency);
    const total = foreign ? convertAmount(originalTotal, currency, trip.currency, rate) : originalTotal;
    if (total <= 0 || total > 2_000_000_000) {
      throw new ActionError(total <= 0 ? "El monto convertido es demasiado bajo" : "El monto convertido es demasiado alto", {
        amount: ["Revisa el monto o el tipo de cambio"],
      });
    }
    // Reparte el total convertido en la misma proporción que los montos originales.
    const convertRows = <T extends { memberId: string; amount: number }>(rows: T[]) => {
      if (!foreign) return rows;
      const converted = allocateProportional(total, rows.map((r) => r.amount));
      return rows.map((r, i) => ({ ...r, amount: converted[i] })).filter((r) => r.amount > 0);
    };

    // 1) Quién pagó → ExpensePayer[] (suma exacta = total).
    const originalPayers =
      input.paidBy.mode === "single"
        ? [{ memberId: input.paidBy.memberId, amount: originalTotal }]
        : input.paidBy.payers
            .map((p) => ({ memberId: p.memberId, amount: toMinor(p.amount, currency) }))
            .filter((p) => p.amount > 0);
    assertMembers(originalPayers.map((p) => p.memberId), "paidBy");
    // Solo puedes anotar lo que pagaste tú (o alguien sin cuenta / tu hijo/a).
    const byId = new Map(activeMembers.map((m) => [m.id, m]));
    if (originalPayers.some((p) => !canActFor(me, byId.get(p.memberId)!))) {
      throw new ActionError("Solo puedes registrar gastos que pagaste tú", {
        paidBy: ["Cada persona con cuenta registra sus propios pagos"],
      });
    }
    const paidSum = originalPayers.reduce((a, p) => a + p.amount, 0);
    if (originalPayers.length === 0 || paidSum !== originalTotal) {
      throw new ActionError("Lo pagado no coincide con el total del gasto", {
        paidBy: ["La suma de los pagos debe ser igual al total"],
      });
    }
    const payers = convertRows(originalPayers);

    // 2) Cómo se divide → ExpenseSplit[] (suma exacta = total). Partes iguales
    // se reparten sobre el total ya convertido; montos exactos se validan en la
    // moneda original y luego se convierten.
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
      splits =
        splitInput.type === "EXACT"
          ? convertRows(computeSplits(originalTotal, splitInput))
          : computeSplits(total, splitInput);
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
        ...(foreign && { originalCurrency: currency, originalAmount: originalTotal, fxRate: rate }),
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
