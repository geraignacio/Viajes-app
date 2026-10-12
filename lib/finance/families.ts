// Hijos/as a cargo: el saldo de cada hijo/a se suma al de su padre/madre
// ("cabeza de familia") para el cierre de cuentas y la deuda a pagar. Los
// gastos siguen registrados a nombre de cada persona.
import { buildBalances, type MemberBalance } from "./balances.ts";

type Link = { id: string; parentMemberId: string | null };

/** id de integrante → id de quien responde por su saldo (él mismo si no tiene padre/madre). */
export function familyHeads(members: Link[]): Map<string, string> {
  const ids = new Set(members.map((m) => m.id));
  // Un solo nivel: si el padre/madre no está en el viaje, responde por sí mismo.
  return new Map(
    members.map((m) => [m.id, m.parentMemberId && ids.has(m.parentMemberId) ? m.parentMemberId : m.id]),
  );
}

/**
 * Saldo combinado por cabeza de familia (mismos campos que MemberBalance,
 * recalculados sobre las sumas). Los abonos internos padre ↔ hijo se anulan.
 */
export function familyBalances(balances: MemberBalance[], heads: Map<string, string>): MemberBalance[] {
  const order: string[] = [];
  const sums = { paid: new Map<string, number>(), share: new Map(), sent: new Map(), received: new Map() } as Record<
    "paid" | "share" | "sent" | "received",
    Map<string, number>
  >;
  for (const b of balances) {
    const head = heads.get(b.memberId) ?? b.memberId;
    if (!sums.paid.has(head)) {
      order.push(head);
      for (const k of ["paid", "share", "sent", "received"] as const) sums[k].set(head, 0);
    }
    for (const k of ["paid", "share", "sent", "received"] as const) sums[k].set(head, sums[k].get(head)! + b[k]);
  }
  return buildBalances(order, sums);
}
