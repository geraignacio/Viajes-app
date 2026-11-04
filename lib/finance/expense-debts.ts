// Deuda de UN gasto: quién le debe cuánto a quién solo por ese registro
// (ej: "Restaurant X: Beto le debe $12.000 a Ana"). Es una vista de detalle;
// los saldos globales y el cierre de cuentas se siguen calculando igual.
import { allocateProportional } from "./fx.ts";

export type ExpenseDebt = {
  from: string;
  to: string;
  /** Lo que `from` le debe a `to` por este gasto. */
  amount: number;
  /** Lo ya pagado con "Saldar" (abonos ligados al gasto), acotado a `amount`. */
  paid: number;
  /** amount - paid. */
  remaining: number;
};

type Row = { memberId: string; amount: number };

/**
 * Por cada integrante: neto = lo que pagó - lo que le corresponde. Quien queda
 * negativo le debe a quienes quedan positivos, repartido en proporción a lo
 * que cada uno puso de más (con un solo pagador es simplemente "le debe a él").
 * Las deudas dentro de una misma familia (padre/madre ↔ hijo/a) no se muestran.
 */
export function expenseDebts(
  payers: Row[],
  splits: Row[],
  linkedTransfers: { fromMemberId: string; toMemberId: string; amount: number }[] = [],
  headOf: Map<string, string> = new Map(),
): ExpenseDebt[] {
  const net = new Map<string, number>();
  for (const p of payers) net.set(p.memberId, (net.get(p.memberId) ?? 0) + p.amount);
  for (const s of splits) net.set(s.memberId, (net.get(s.memberId) ?? 0) - s.amount);

  const ids = [...net.keys()].sort();
  const creditors = ids.filter((id) => net.get(id)! > 0);
  const debtors = ids.filter((id) => net.get(id)! < 0);
  if (creditors.length === 0) return [];
  const weights = creditors.map((id) => net.get(id)!);

  const paidPair = new Map<string, number>();
  for (const t of linkedTransfers) {
    const k = `${t.fromMemberId}>${t.toMemberId}`;
    paidPair.set(k, (paidPair.get(k) ?? 0) + t.amount);
  }

  const head = (id: string) => headOf.get(id) ?? id;
  const out: ExpenseDebt[] = [];
  for (const d of debtors) {
    const parts = allocateProportional(-net.get(d)!, weights);
    creditors.forEach((c, i) => {
      const amount = parts[i];
      if (amount <= 0 || head(d) === head(c)) return;
      const paid = Math.min(amount, paidPair.get(`${d}>${c}`) ?? 0);
      out.push({ from: d, to: c, amount, paid, remaining: amount - paid });
    });
  }
  return out;
}
