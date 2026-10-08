"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { getTripBalances } from "@/lib/finance/balances";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { deleteInstallmentPlanSchema, installmentPlanSchema } from "@/lib/validation/installment";

/** Solo para uno mismo; el organizador también puede hacerlo por otros (ej: sin cuenta). */
async function assertCanManage(tripId: string, memberId: string) {
  const { member } = await requireMember(tripId);
  if (member.id !== memberId && member.role === "MEMBER") {
    throw new ActionError("Solo puedes administrar tu propio plan de cuotas");
  }
  const target = await prisma.tripMember.findFirst({ where: { id: memberId, tripId }, select: { id: true } });
  if (!target) throw new ActionError("Integrante inválido");
}

/**
 * Crea o reemplaza el plan "pago mi deuda en N cuotas". La deuda base es el
 * restante actual de la persona; las cuotas vencen cada mes desde firstDueDate.
 */
export async function saveInstallmentPlan(raw: unknown): Promise<ActionResult<{ perInstallment: number }>> {
  const parsed = installmentPlanSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { tripId, memberId, installments, firstDueDate } = parsed.data;

  try {
    await assertCanManage(tripId, memberId);
    const balance = (await getTripBalances(prisma, tripId)).find((b) => b.memberId === memberId);
    const debt = balance?.remaining ?? 0;
    if (debt <= 0) throw new ActionError("No hay deuda pendiente para dividir en cuotas");
    if (debt < installments) throw new ActionError("La deuda es demasiado pequeña para tantas cuotas");

    const data = {
      installments,
      baseAmount: debt,
      baseContributed: balance!.contributed,
      firstDueDate: new Date(firstDueDate),
    };
    await prisma.installmentPlan.upsert({
      where: { memberId },
      create: { memberId, ...data },
      update: data,
    });
    revalidatePath(`/trips/${tripId}`);
    return ok({ perInstallment: Math.ceil(debt / installments) });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInstallmentPlan(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deleteInstallmentPlanSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await assertCanManage(parsed.data.tripId, parsed.data.memberId);
    await prisma.installmentPlan.deleteMany({ where: { memberId: parsed.data.memberId } });
    revalidatePath(`/trips/${parsed.data.tripId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
