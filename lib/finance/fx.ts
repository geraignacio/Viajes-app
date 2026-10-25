// Gastos en otra moneda: se convierten a la moneda del viaje al guardarlos.
// Los saldos se calculan siempre en la moneda del viaje, así que lo único que
// hay que garantizar es que la conversión mantenga las sumas exactas.

/**
 * Convierte un monto en unidades mínimas de una moneda a otra.
 * `rate` = unidades mayores de la moneda destino por 1 unidad mayor de la origen
 * (ej: 1 BRL = 172,35 CLP). `fromDigits`/`toDigits` = decimales de cada moneda.
 */
export function convertMinor(minor: number, rate: number, fromDigits: number, toDigits: number): number {
  return Math.round((minor / 10 ** fromDigits) * rate * 10 ** toDigits);
}

/**
 * Reparte `total` en proporción a `weights` con el método del mayor resto:
 * el resultado son enteros que suman exactamente `total`. Los empates de resto
 * se resuelven por orden de aparición (determinista).
 *   allocateProportional(25853, [10000, 5000]) → [17235, 8618]
 */
export function allocateProportional(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0) throw new Error("Se requiere al menos un peso positivo");
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, n) => a + n, 0);
  const order = raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .filter(({ i }) => weights[i] > 0)
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}
