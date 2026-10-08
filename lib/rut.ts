// Utilidades de RUT chileno (sin dependencias, usadas en cliente y servidor).

/** Valida un RUT chileno (dígito verificador módulo 11). Acepta 12.345.678-5 o 12345678-5. */
export function isValidRut(raw: string): boolean {
  const clean = raw.replace(/[.\s]/g, "").toUpperCase();
  const m = clean.match(/^(\d{7,8})-?([\dK])$/);
  if (!m) return false;
  let sum = 0;
  let mul = 2;
  for (let i = m[1].length - 1; i >= 0; i--) {
    sum += Number(m[1][i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dv = 11 - (sum % 11);
  const expected = dv === 11 ? "0" : dv === 10 ? "K" : String(dv);
  return expected === m[2];
}

/** Normaliza a 12.345.678-5 */
export function formatRut(raw: string): string {
  const clean = raw.replace(/[.\s-]/g, "").toUpperCase();
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${clean.slice(-1)}`;
}
