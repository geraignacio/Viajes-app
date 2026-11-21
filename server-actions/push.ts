"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/access";
import { ActionError, fail, invalid, ok, type ActionResult } from "@/lib/action-result";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }),
});

/** Guarda (o mueve a esta cuenta) la suscripción push de este navegador. */
export async function savePushSubscription(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Debes iniciar sesión");
    const { endpoint, keys } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: user.id },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id },
    });
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult<undefined>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Debes iniciar sesión");
    await prisma.pushSubscription.deleteMany({ where: { endpoint: String(endpoint).slice(0, 2048), userId: user.id } });
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
