"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/access";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { paymentInfoSchema } from "@/lib/validation/payment-info";

/** Guarda los datos de transferencia del usuario que inició sesión (solo los propios). */
export async function savePaymentInfo(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = paymentInfoSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Debes iniciar sesión");
    // undefined → null para que borrar un campo lo deje vacío.
    const data = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v ?? null]));
    await prisma.paymentInfo.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deletePaymentInfo(): Promise<ActionResult<undefined>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Debes iniciar sesión");
    await prisma.paymentInfo.deleteMany({ where: { userId: user.id } });
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
