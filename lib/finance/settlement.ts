// Liquidación: quién transfiere cuánto a quién para dejar todo en cero
// con el MENOR número de transferencias.
//
// Idea clave: con k personas con saldo != 0, cualquier liquidación necesita
// al menos k - g transferencias, donde g es el máximo número de grupos
// disjuntos cuyo saldo suma 0 (cada grupo se liquida internamente con
// |grupo| - 1 pagos). Encontrar g es NP-difícil en general (subset-sum), pero
// en un viaje k es pequeño: con k <= 20 se resuelve exacto con DP sobre
// máscaras de bits en O(2^k · k). Para k mayor se usa el greedy clásico
// (mayor deudor ↔ mayor acreedor), que garantiza <= k - 1 transferencias.

export type Settlement = { from: string; to: string; amount: number };

const EXACT_LIMIT = 20;

export function minimizeTransfers(
  balances: { memberId: string; balance: number }[],
): Settlement[] {
  const nonZero = balances.filter((b) => b.balance !== 0);
  const total = nonZero.reduce((a, b) => a + b.balance, 0);
  if (total !== 0) throw new Error(`Los saldos no cuadran (suma = ${total})`);
  if (nonZero.length === 0) return [];

  if (nonZero.length > EXACT_LIMIT) return greedy(nonZero);
  return partitionIntoZeroGroups(nonZero).flatMap(greedy);
}

/** Greedy: empareja siempre el mayor deudor con el mayor acreedor. */
function greedy(group: { memberId: string; balance: number }[]): Settlement[] {
  const debtors = group
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.memberId, amt: -b.balance }))
    .sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  const creditors = group
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.memberId, amt: b.balance }))
    .sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));

  const result: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    result.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return result;
}

/**
 * DP sobre subconjuntos: dp[mask] = máximo número de grupos de suma cero
 * completos usando exactamente los miembros de `mask`. Como la suma total es
 * 0, dp[full] es el g óptimo. Luego se reconstruyen los grupos.
 */
function partitionIntoZeroGroups(
  items: { memberId: string; balance: number }[],
): { memberId: string; balance: number }[][] {
  const k = items.length;
  const full = (1 << k) - 1;
  const sum = new Float64Array(1 << k);
  const dp = new Int8Array(1 << k);
  const parent = new Int32Array(1 << k); // último miembro agregado

  for (let mask = 1; mask <= full; mask++) {
    const low = 31 - Math.clz32(mask & -mask);
    sum[mask] = sum[mask & (mask - 1)] + items[low].balance;
    let best = -1;
    let bestBit = 0;
    for (let b = 0; b < k; b++) {
      if (!(mask & (1 << b))) continue;
      const prev = mask ^ (1 << b);
      if (dp[prev] > best) {
        best = dp[prev];
        bestBit = b;
      }
    }
    // Si el subconjunto completo suma 0, cierra un grupo.
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
    parent[mask] = bestBit;
  }

  // Reconstrucción: recorrer agregando miembros en orden; cada vez que el
  // prefijo acumulado vuelve a sumar 0 se cierra un grupo.
  const order: number[] = [];
  for (let mask = full; mask; mask ^= 1 << parent[mask]) order.push(parent[mask]);
  order.reverse();

  const groups: { memberId: string; balance: number }[][] = [];
  let current: { memberId: string; balance: number }[] = [];
  let acc = 0;
  for (const idx of order) {
    current.push(items[idx]);
    acc += items[idx].balance;
    if (acc === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups;
}
