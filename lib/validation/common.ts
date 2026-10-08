import { z } from "zod";

export const id = z.string().min(1, "Requerido").max(40);

/** Monto en unidades mayores tal como lo escribe la persona (ej: 12.5). */
export const positiveAmount = z
  .number({ error: "Ingresa un monto válido" })
  .finite()
  .positive("Debe ser mayor a 0")
  .max(1_000_000_000, "Monto demasiado alto");

export const nonNegativeAmount = z
  .number({ error: "Ingresa un monto válido" })
  .finite()
  .min(0, "No puede ser negativo")
  .max(1_000_000_000, "Monto demasiado alto");

export const isoDate = z.iso.date({ error: "Fecha inválida" });

/** Texto opcional: "" y espacios se normalizan a undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));
