import "server-only";

// Tipo de cambio del día desde APIs públicas gratuitas y sin clave:
//  1. fawazahmed0/currency-api (jsDelivr, con respaldo en Cloudflare Pages):
//     tasas diarias con historial por fecha, incluye CLP, ARS, BRL, etc.
//  2. open.er-api.com (ExchangeRate-API, acceso abierto): solo la tasa actual.
// Next guarda las respuestas en caché 6 h, así que cada par se pide pocas veces.

export type FxQuote = { rate: number; date: string; source: string };

const TIMEOUT_MS = 5_000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate: 6 * 3600 },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function fromCurrencyApi(from: string, to: string, day: string): Promise<FxQuote> {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${day}/v1/currencies/${f}.min.json`,
    `https://${day}.currency-api.pages.dev/v1/currencies/${f}.min.json`,
  ];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const data = (await getJson(url)) as { date?: string } & Record<string, Record<string, number>>;
      const rate = data[f]?.[t];
      if (typeof rate === "number" && rate > 0) {
        return { rate, date: data.date ?? day, source: "currency-api" };
      }
      lastError = new Error(`Sin tasa ${from}→${to}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

async function fromOpenErApi(from: string, to: string): Promise<FxQuote> {
  const data = (await getJson(`https://open.er-api.com/v6/latest/${from}`)) as {
    result?: string;
    time_last_update_unix?: number;
    rates?: Record<string, number>;
  };
  const rate = data.rates?.[to];
  if (data.result !== "success" || typeof rate !== "number" || rate <= 0) {
    throw new Error(`Sin tasa ${from}→${to}`);
  }
  const date = new Date((data.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10);
  return { rate, date, source: "open.er-api" };
}

/**
 * Cuántas unidades de `to` vale 1 unidad de `from` en la fecha `isoDay`
 * (YYYY-MM-DD). Para hoy o fechas futuras usa la tasa más reciente.
 */
export async function getExchangeRate(from: string, to: string, isoDay?: string): Promise<FxQuote> {
  if (from === to) return { rate: 1, date: isoDay ?? new Date().toISOString().slice(0, 10), source: "same" };
  const today = new Date().toISOString().slice(0, 10);
  const day = isoDay && isoDay < today ? isoDay : "latest";
  try {
    return await fromCurrencyApi(from, to, day);
  } catch (e) {
    // Fechas muy antiguas no están en el historial: se intenta con la actual.
    if (day !== "latest") {
      try {
        return await fromCurrencyApi(from, to, "latest");
      } catch {}
    }
    try {
      return await fromOpenErApi(from, to);
    } catch {
      throw e;
    }
  }
}
