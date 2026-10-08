// Montos: la BD guarda enteros en unidades mínimas (CLP: pesos, USD: centavos).
// Los formularios trabajan en unidades "mayores" (12.50 USD) y se convierten
// aquí, en un solo lugar.

const LOCALE = "es-CL";

const digitsCache = new Map<string, number>();

export function currencyDigits(currency: string): number {
  let d = digitsCache.get(currency);
  if (d === undefined) {
    d =
      new Intl.NumberFormat(LOCALE, { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    digitsCache.set(currency, d);
  }
  return d;
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyDigits(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency);
}

export function formatMoney(minor: number, currency: string): string {
  // Intl en es-CL produce "$-80.000"; se antepone el signo para leer "-$80.000".
  if (minor < 0) return `-${formatMoney(-minor, currency)}`;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: currencyDigits(currency),
    maximumFractionDigits: currencyDigits(currency),
  }).format(toMajor(minor, currency));
}

/** Paso del input numérico según la moneda: 1 para CLP, 0.01 para USD. */
export function inputStep(currency: string): string {
  const d = currencyDigits(currency);
  return d === 0 ? "1" : (1 / 10 ** d).toFixed(d);
}

/** Fechas @db.Date llegan como medianoche UTC: se formatean en UTC. */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}
