// Reparto de un monto entero (unidades mínimas) entre participantes.
// Garantiza: sum(resultado) === total, sin decimales.

export type SplitInput =
  | { type: "EQUAL_ALL" | "EQUAL_SELECTED"; memberIds: string[] }
  | { type: "EXACT"; shares: { memberId: string; amount: number }[] };

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

export function computeSplits(total: number, input: SplitInput): SplitRow[] {
  if (input.type === "EXACT") {
    const sum = input.shares.reduce((acc, s) => acc + s.amount, 0);
    if (sum !== total) {
      throw new Error(`Los montos exactos suman ${sum}, pero el gasto es ${total}`);
    }
    return input.shares.filter((s) => s.amount > 0);
  }
  return splitEqually(total, input.memberIds);
}
