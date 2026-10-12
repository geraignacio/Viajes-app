"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { getTripBalances } from "@/lib/finance/balances";
import { familyBalances, familyHeads } from "@/lib/finance/families";
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

/** Saldo con el que se arma el plan: el propio más el de los hijos/as a cargo. */
async function planBalance(tripId: string, memberId: string) {
  const [balances, members] = await Promise.all([
    getTripBalances(prisma, tripId),
    prisma.tripMember.findMany({ where: { tripId }, select: { id: true, parentMemberId: true } }),
  ]);
  const heads = familyHeads(members);
  if (heads.get(memberId) !== memberId) throw new ActionError("La deuda de un hijo/a la paga su padre o madre");
  return familyBalances(balances, heads).find((b) => b.memberId === memberId);
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
    const balance = await planBalance(tripId, memberId);
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
