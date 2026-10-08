// Formato de los datos de transferencia (sin zod: se usa también en el cliente).

export const PAYMENT_FIELDS = [
  ["holderName", "Nombre"],
  ["rut", "RUT"],
  ["bank", "Banco"],
  ["accountType", "Tipo de cuenta"],
  ["accountNumber", "N° de cuenta"],
  ["email", "Correo"],
  ["notes", "Otros"],
] as const;

export type PaymentInfoLite = Partial<Record<(typeof PAYMENT_FIELDS)[number][0], string | null>>;

/** Texto listo para pegar en la app del banco. */
export function paymentInfoText(p: PaymentInfoLite): string {
  return PAYMENT_FIELDS.filter(([k]) => p[k])
    .map(([k, label]) => `${label}: ${p[k]}`)
    .join("\n");
}
