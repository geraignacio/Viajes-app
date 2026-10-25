// Reparto de un monto entero (unidades mínimas) entre participantes.
// Garantiza: sum(resultado) === total, sin decimales.

import { allocateProportional } from "./fx.ts";

export type SplitItem = { amount: number; memberIds: string[] };

export type SplitInput =
  | { type: "EQUAL_ALL" | "EQUAL_SELECTED"; memberIds: string[] }
  | { type: "EXACT"; shares: { memberId: string; amount: number }[] }
  | { type: "ITEMIZED"; items: SplitItem[] };

export type SplitRow = { memberId: string; amount: number };

/**
 * Divide `total` en partes iguales. El resto (total % n) se reparte de a 1
 * unidad a los primeros `resto` participantes ordenados por id, de modo que
 * el resultado es determinista (mismo input → mismo reparto) y exacto.
 *   10.000 CLP / 3 → 3.334, 3.333, 3.333
 */
export function splitEqually(total: number, memberIds: string[]): SplitRow[] {
  const ids = [...new Set(memberIds)].sort();
  if (ids.length === 0) throw new Error("Se requiere al menos un participante");
  const base = Math.floor(total / ids.length);
  const remainder = total - base * ids.length;
  return ids.map((memberId, i) => ({
    memberId,
    amount: base + (i < remainder ? 1 : 0),
  }));
}

/**
 * División por ítem: cada ítem se reparte en partes iguales entre quienes lo
 * marcaron. Lo que sobra entre la suma de los ítems y el total (propina,
 * servicio, impuestos) se reparte en proporción a lo que consumió cada uno.
 *   Pizza 10.000 (Ana, Beto) + Vino 6.000 (Ana), total 17.600 con propina
 *   → Ana 11.000 + 1.100 = 12.100, Beto 5.000 + 500 = 5.500
 */
export function splitByItems(total: number, items: SplitItem[]): SplitRow[] {
  const subtotal = new Map<string, number>();
  for (const item of items) {
    for (const s of splitEqually(item.amount, item.memberIds)) {
      subtotal.set(s.memberId, (subtotal.get(s.memberId) ?? 0) + s.amount);
    }
  }
  const ids = [...subtotal.keys()].sort();
  const itemsSum = items.reduce((a, i) => a + i.amount, 0);
  if (ids.length === 0 || itemsSum > total) {
    throw new Error(`Los ítems suman ${itemsSum}, más que el gasto (${total})`);
  }
  const extra = allocateProportional(total - itemsSum, ids.map((id) => subtotal.get(id)!));
  return ids
    .map((memberId, i) => ({ memberId, amount: subtotal.get(memberId)! + extra[i] }))
    .filter((s) => s.amount > 0);
}

export function computeSplits(total: number, input: SplitInput): SplitRow[] {
  if (input.type === "ITEMIZED") return splitByItems(total, input.items);
  if (input.type === "EXACT") {
    const sum = input.shares.reduce((acc, s) => acc + s.amount, 0);
    if (sum !== total) {
      throw new Error(`Los montos exactos suman ${sum}, pero el gasto es ${total}`);
    }
    return input.shares.filter((s) => s.amount > 0);
  }
  return splitEqually(total, input.memberIds);
}
