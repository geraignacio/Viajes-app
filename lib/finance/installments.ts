// Plan de pago en cuotas: divide una deuda en N cuotas mensuales y calcula el
// avance a partir de lo que la persona todavía debe. Funciones puras.

export type InstallmentPlanInput = {
  installments: number;
  /** Deuda al crear el plan (unidades mínimas). */
  baseAmount: number;
  /** Lo aportado (pagado + enviado - recibido) al crear el plan. */
  baseContributed: number;
  /** "YYYY-MM-DD" o Date a medianoche UTC. */
  firstDueDate: Date | string;
};

export type Installment = {
  n: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: "paid" | "next" | "pending";
  /** 0..1 de la cuota que ya está cubierta (solo la "next" puede ser parcial). */
  covered: number;
};

export type InstallmentStatus = {
  schedule: Installment[];
  /** Monto de cuota (las últimas pueden llevar 1 unidad menos por redondeo). */
  perInstallment: number;
  paidCount: number;
  /** Lo abonado desde que se creó el plan. */
  paidSinceStart: number;
  completed: boolean;
  /** La deuda actual supera lo que el plan espera (se agregaron gastos): conviene actualizarlo. */
  outdated: boolean;
  next: Installment | null;
};

/** Divide `total` en `n` cuotas enteras que suman exactamente `total`. */
export function splitInstallments(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Suma `months` meses a una fecha ISO; si el día no existe, usa el último del mes. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const toISO = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * `now.contributed` y `now.remaining` vienen de los saldos actuales. Lo pagado
 * desde el plan se mide por lo aportado, así un gasto nuevo no "despaga" cuotas.
 */
export function installmentStatus(
  plan: InstallmentPlanInput,
  now: { remaining: number; contributed: number },
): InstallmentStatus {
  const currentRemaining = now.remaining;
  const amounts = splitInstallments(plan.baseAmount, plan.installments);
  const paidSinceStart = Math.min(plan.baseAmount, Math.max(0, now.contributed - plan.baseContributed));
  const first = toISO(plan.firstDueDate);

  let cumulative = 0;
  let nextAssigned = false;
  const schedule: Installment[] = amounts.map((amount, i) => {
    const before = cumulative;
    cumulative += amount;
    let status: Installment["status"] = "pending";
    let covered = 0;
    if (paidSinceStart >= cumulative) {
      status = "paid";
      covered = 1;
    } else if (!nextAssigned) {
      status = "next";
      nextAssigned = true;
      covered = Math.max(0, paidSinceStart - before) / amount;
    }
    return { n: i + 1, amount, dueDate: addMonths(first, i), status, covered };
  });

  const paidCount = schedule.filter((s) => s.status === "paid").length;
  return {
    schedule,
    perInstallment: amounts[0],
    paidCount,
    paidSinceStart,
    completed: currentRemaining === 0 || paidCount === plan.installments,
    outdated: currentRemaining > plan.baseAmount - paidSinceStart,
    next: schedule.find((s) => s.status === "next") ?? null,
  };
}
