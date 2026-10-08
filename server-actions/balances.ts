"use server";

import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { getTripBalances, type MemberBalance } from "@/lib/finance/balances";
import { minimizeTransfers, type Settlement } from "@/lib/finance/settlement";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { id } from "@/lib/validation/common";

/**
 * Saldos + liquidación sugerida de un viaje. Las páginas usan
 * lib/trips.getTripDashboard directamente; esta acción queda para clientes
 * que necesiten recalcular sin recargar (por ejemplo, una app móvil o un widget).
 */
export async function getTripFinance(
  tripId: unknown,
): Promise<ActionResult<{ balances: MemberBalance[]; settlement: Settlement[] }>> {
  const parsed = id.safeParse(tripId);
  if (!parsed.success) return { ok: false, error: "Viaje inválido" };
  try {
    await requireMember(parsed.data);
    const balances = await getTripBalances(prisma, parsed.data);
    return ok({ balances, settlement: minimizeTransfers(balances) });
  } catch (e) {
    return fail(e);
  }
}
